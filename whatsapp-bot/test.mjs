// Prueba la lógica del bot sin depender de npm install ni de credenciales reales:
// se simula fetch() global para no pegarle a Firestore/Gemini/WhatsApp de verdad.
import { fetchItems, askGemini, sendWhatsApp, extractIncomingMessage, buildPrompt, money } from "./lib.js";

let calls = [];
const originalFetch = globalThis.fetch;

function mockFetch(url, opts) {
  calls.push({ url, opts });
  if (url.includes("firestore.googleapis.com")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        documents: [
          {
            name: "projects/x/databases/(default)/documents/items/p1",
            fields: {
              t: { stringValue: "planta" },
              n: { stringValue: "Ficus lyrata" },
              k: { doubleValue: 3000 },
              p: { doubleValue: 7000 },
              x: { mapValue: { fields: { fam: { stringValue: "Moraceae" }, ubi: { stringValue: "Interior" } } } },
            },
          },
          {
            name: "projects/x/databases/(default)/documents/items/p2",
            fields: {
              t: { stringValue: "maceta" },
              n: { stringValue: "Maceta de barro 15cm" },
              k: { doubleValue: 500 },
              p: { doubleValue: 1200 },
              x: { mapValue: { fields: { med: { stringValue: "15cm" } } } },
            },
          },
        ],
      }),
    });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "El Ficus lyrata sale $7.000. ¿Te separo uno?" }] } }] }),
    });
  }
  if (url.includes("graph.facebook.com")) {
    return Promise.resolve({ ok: true, json: async () => ({ messages: [{ id: "wamid.test" }] }) });
  }
  return Promise.reject(new Error("unexpected fetch " + url));
}

async function main() {
  globalThis.fetch = mockFetch;

  const items = await fetchItems({ projectId: "morlinavivero-90956", apiKey: "TESTKEY" });
  console.log("fetchItems count (expect 2):", items.length);
  console.log("fetchItems first name (expect 'Ficus lyrata'):", items[0].n);

  const prompt = buildPrompt("cuanto sale el ficus?", items);
  console.log("prompt includes inventory line (expect true):", prompt.includes("Ficus lyrata|Plantas"));
  console.log("prompt includes price (expect true):", prompt.includes(money(7000)));

  const answer = await askGemini("cuanto sale el ficus?", items, "TESTKEY");
  console.log("askGemini answer (expect to include 7.000):", answer);

  const ok = await sendWhatsApp({ to: "5491122334455", text: answer, token: "TESTTOKEN", phoneNumberId: "123456" });
  console.log("sendWhatsApp ok (expect true):", ok);
  const waCall = calls.find((c) => c.url.includes("graph.facebook.com"));
  console.log("whatsapp call used Bearer token (expect true):", waCall.opts.headers.Authorization === "Bearer TESTTOKEN");
  console.log("whatsapp call body has 'to' and 'text' (expect true):", (() => {
    const b = JSON.parse(waCall.opts.body);
    return b.to === "5491122334455" && b.text.body === answer && b.messaging_product === "whatsapp";
  })());

  const incoming = extractIncomingMessage({
    entry: [{ changes: [{ value: { messages: [{ from: "5491122334455", text: { body: "  cuanto sale el ficus?  " } }] } }] }],
  });
  console.log("extractIncomingMessage from (expect 5491122334455):", incoming.from);
  console.log("extractIncomingMessage text trimmed (expect 'cuanto sale el ficus?'):", incoming.text);

  const noMsg = extractIncomingMessage({ entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] });
  console.log("extractIncomingMessage returns null for status event (expect true):", noMsg === null);

  globalThis.fetch = originalFetch;
  console.log("ALL DONE, no exceptions thrown");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
