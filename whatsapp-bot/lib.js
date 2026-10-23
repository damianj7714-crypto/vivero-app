/* Lógica del bot, separada de Express para poder probarla sin dependencias externas. */

const T = { planta: "Plantas", maceta: "Macetas", tierra: "Tierras", accesorio: "Accesorios", quimico: "Químicos" };

export function money(v) {
  return "$" + (Number(v) || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function fromVal(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("mapValue" in v) return fromFields((v.mapValue || {}).fields || {});
  if ("arrayValue" in v) return (((v.arrayValue || {}).values) || []).map(fromVal);
  return null;
}
function fromFields(fl) {
  const o = {};
  for (const k in fl) o[k] = fromVal(fl[k]);
  return o;
}

export async function fetchItems({ projectId, apiKey }) {
  let out = [], pageToken = "";
  do {
    const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/items?pageSize=300&key=${apiKey}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const r = await fetch(url);
    if (!r.ok) throw new Error("firestore " + r.status);
    const j = await r.json();
    (j.documents || []).forEach((d) => out.push(Object.assign({ id: d.name.split("/").pop() }, fromFields(d.fields || {}))));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return out;
}

export function buildPrompt(question, items) {
  const list = items
    .map((i) => `${i.n}|${T[i.t] || i.t}|${Object.values(i.x || {}).filter(Boolean).join(", ")}|precio de venta: ${money(i.p)}`)
    .join("\n");
  return (
    `Sos el asistente de WhatsApp de "Morlina", un vivero de plantas. Un cliente te escribe una pregunta por WhatsApp. Respondé SOLO en base a esta lista real de inventario (nombre|categoría|detalles|precio de venta):\n${list}\n\n` +
    `Pregunta del cliente: "${question}"\n\n` +
    `Instrucciones:\n` +
    `- Si encontrás uno o varios productos que coinciden, respondé con su nombre y precio de venta, en un mensaje breve, cordial y natural de WhatsApp (sin markdown ni asteriscos).\n` +
    `- Si hay varias opciones parecidas (por ejemplo distintos tamaños), mencioná las 2 o 3 más relevantes con su precio cada una.\n` +
    `- Si no encontrás nada parecido en la lista, decí amablemente que por ahora no tenés ese producto y que un encargado del vivero puede confirmar disponibilidad.\n` +
    `- No inventes precios ni productos que no estén en la lista.\n` +
    `- Si la pregunta no tiene nada que ver con plantas o el vivero, respondé amablemente que solo podés ayudar con consultas de productos del vivero.\n` +
    `- Respondé en español, tono amable de atención al cliente, sin firmas ni encabezados.`
  );
}

export async function askGemini(question, items, key) {
  const prompt = buildPrompt(question, items);
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  let lastErr = null;
  for (const m of ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]) {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
    });
    if (resp.status === 404) {
      lastErr = Object.assign(new Error("modelo no disponible"), { status: 404 });
      continue;
    }
    if (!resp.ok) throw Object.assign(new Error("gemini"), { status: resp.status });
    const j = await resp.json();
    return (j.candidates[0].content.parts[0].text || "").trim();
  }
  throw lastErr || new Error("gemini");
}

export async function sendWhatsApp({ to, text, token, phoneNumberId, apiVersion = "v21.0" }) {
  const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("Error enviando WhatsApp", r.status, t);
  }
  return r.ok;
}

export function extractIncomingMessage(body) {
  const entry = (body.entry || [])[0];
  const change = (entry && entry.changes && entry.changes[0]) || {};
  const value = change.value || {};
  const msg = (value.messages || [])[0];
  if (!msg) return null;
  return { from: msg.from, text: msg.text && msg.text.body ? msg.text.body.trim() : "" };
}
