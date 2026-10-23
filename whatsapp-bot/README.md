# Bot de WhatsApp — Morlina / ViveroApp

Responde por WhatsApp a preguntas de clientes sobre precios y disponibilidad,
usando el mismo inventario (Firestore) que usa la app, y Gemini para entender
la pregunta en lenguaje natural.

## Variables de entorno necesarias

Ver `.env.example`. Se configuran en el panel de tu hosting (Render, etc.),
nunca en un archivo subido al repo.

- `WHATSAPP_TOKEN` — token de acceso de WhatsApp Cloud API (Meta for Developers).
- `WHATSAPP_PHONE_NUMBER_ID` — el "Phone Number ID" que te da Meta.
- `VERIFY_TOKEN` — una palabra secreta que vos elegís, se usa para verificar el webhook.
- `GEMINI_API_KEY` — tu clave de Google AI Studio (la misma que usa la app).

## Deploy en Render (gratis)

1. New → Web Service, conectá el repo `vivero-app`.
2. Root Directory: `whatsapp-bot`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Agregá las variables de entorno de arriba.
6. Deploy. Copiá la URL pública que te da Render (termina en `.onrender.com`).

## Configurar el webhook en Meta

En tu app de Meta for Developers → WhatsApp → Configuration:
- Callback URL: `https://TU-URL-DE-RENDER.onrender.com/webhook`
- Verify token: el mismo valor que pusiste en `VERIFY_TOKEN`
- Suscribite al campo `messages`.

## Probar sin desplegar nada

```
node test.mjs
```

Corre la lógica del bot con Firestore/Gemini/WhatsApp simulados (sin gastar
cuota ni necesitar claves reales), para confirmar que arma bien las
respuestas antes de desplegar.
