import express from "express";
import { fetchItems, askGemini, sendWhatsApp, extractIncomingMessage } from "./lib.js";

const app = express();
app.use(express.json());

const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  VERIFY_TOKEN,
  GEMINI_API_KEY,
  FIRESTORE_PROJECT_ID = "morlinavivero-90956",
  FIRESTORE_API_KEY = "AIzaSyAVjMnA_eStmyurFJOoG2TbCCChfhKUdyA",
  WHATSAPP_API_VERSION = "v21.0",
  PORT = 3000,
} = process.env;

app.get("/", (_req, res) => res.send("Vivero WhatsApp bot OK"));

/* Verificación del webhook (Meta la llama una vez al configurar) */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

/* Mensajes entrantes de WhatsApp */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // responder rápido; WhatsApp reintenta si no hay 200 pronto
  try {
    const incoming = extractIncomingMessage(req.body);
    if (!incoming) return; // puede ser un evento de estado (entregado/leído), no un mensaje nuevo

    const reply = (text) =>
      sendWhatsApp({ to: incoming.from, text, token: WHATSAPP_TOKEN, phoneNumberId: WHATSAPP_PHONE_NUMBER_ID, apiVersion: WHATSAPP_API_VERSION });

    if (!incoming.text) {
      await reply("Por ahora puedo responder consultas de texto sobre precios y disponibilidad de plantas 🌿. ¿Qué estás buscando?");
      return;
    }

    const items = await fetchItems({ projectId: FIRESTORE_PROJECT_ID, apiKey: FIRESTORE_API_KEY });
    if (!items.length) {
      await reply("Estamos actualizando el catálogo en este momento. En breve te respondemos 🌱");
      return;
    }

    const answer = await askGemini(incoming.text, items, GEMINI_API_KEY);
    await reply(answer || "No pude procesar tu consulta, ¿podés reformularla?");
  } catch (e) {
    console.error("Error en webhook:", e);
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log("Vivero WhatsApp bot escuchando en puerto " + PORT));
}

export default app;
