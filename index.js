const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Verificar variable de entorno
if (!process.env.ACCESS_TOKEN) {
  console.error("❌ ERROR: ACCESS_TOKEN no definido en las variables de entorno");
  process.exit(1);
} else {
  console.log("✅ ACCESS_TOKEN detectado correctamente");
}

// 🔹 Configuración de Mercado Pago
mercadopago.configurations = {
  access_token: process.env.ACCESS_TOKEN
};

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Endpoint para crear preferencia de pago
app.post('/create_preference', async (req, res) => {
  try {
    const {
      title,
      quantity,
      price,
      back_urls,
      statement_descriptor,
      external_reference,
      notification_url
    } = req.body;

    // 🔹 Validación mínima
    if (!title || !quantity || !price || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
      console.log("❌ Payload incompleto recibido:", req.body);
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    const preference = {
      items: [{ title, unit_price: price, quantity }],
      back_urls,
      auto_return: 'approved',
      statement_descriptor,
      external_reference,
      notification_url
    };

    console.log("💡 Creando preferencia con:", preference);

    const response = await mercadopago.preferences.create(preference);

    console.log("💡 Preferencia creada:", response.body);

    res.json({ preferenceId: response.body.id });
  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
