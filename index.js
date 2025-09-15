// index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Hardcodeamos el Access Token de producción
const ACCESS_TOKEN = "APP_USR-6437200091418350-091312-ebf83f1b75b73b503d382653ed4fc8cf-237587532";
if (!ACCESS_TOKEN) {
  console.error("❌ ACCESS_TOKEN no definido");
  process.exit(1);
} else {
  console.log("✅ ACCESS_TOKEN definido correctamente");
  console.log("🔹 Primeros 10 caracteres del token:", ACCESS_TOKEN.slice(0, 10) + "...");
}

// 🔹 Inicializamos cliente con v2 SDK
const mpClient = new mercadopago({ access_token: ACCESS_TOKEN });

app.use(cors());
app.use(bodyParser.json());

// Ruta raíz para debug
app.get('/', (req, res) => {
  console.log("💡 GET / recibido");
  res.send("Servidor de Mercado Pago corriendo correctamente");
});

// 🔹 Endpoint para crear preferencia
app.post('/create_preference', async (req, res) => {
  console.log("💡 POST /create_preference recibido");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const {
    title,
    quantity,
    price,
    back_urls,
    statement_descriptor,
    external_reference,
    notification_url,
    payer_email
  } = req.body;

  if (!title || !quantity || !price || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
    console.warn("⚠️ Payload incompleto:", req.body);
    return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
  }

  const preferenceData = {
    items: [
      { title, unit_price: Number(price), quantity: Number(quantity) }
    ],
    back_urls,
    auto_return: 'approved',
    statement_descriptor,
    external_reference,
    notification_url,
    payer: {
      email: payer_email || "test_user_123456@test.com"
    }
  };

  console.log("💡 Preference data a enviar a MP:", JSON.stringify(preferenceData, null, 2));

  try {
    const response = await mpClient.preferences.create(preferenceData);
    console.log("✅ Preferencia creada correctamente");
    console.log("💎 Response completo de MP:", JSON.stringify(response, null, 2));

    res.json({
      preferenceId: response.body.id,
      init_point: response.body.init_point
    });
  } catch (error) {
    console.error("❌ Error creando preferencia en MP:", error);
    res.status(500).json({
      error: 'Error creando la preferencia',
      details: error.message
    });
  }
});

// Servidor escuchando
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
