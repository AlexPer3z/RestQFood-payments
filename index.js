// 🔹 Carga dotenv solo en desarrollo
if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Validación de la variable de entorno
if (!process.env.ACCESS_TOKEN) {
  console.error("❌ ERROR: ACCESS_TOKEN no definido en las variables de entorno");
  process.exit(1); // termina el servidor si no está definido
}

// Configuración de Mercado Pago
mercadopago.configurations.setAccessToken(process.env.ACCESS_TOKEN);

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
      email,
      marketplace_fee,
      collector_id,
      back_urls,
      statement_descriptor,
      external_reference,
      notification_url
    } = req.body;

    // 🔹 Validación de campos obligatorios
    if (!title || !quantity || !price || !email || !collector_id || !marketplace_fee || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    const preference = {
      items: [{ title, unit_price: price, quantity }],
      marketplace_fee,
      payer: { email },
      collector_id,
      back_urls,
      auto_return: 'approved',
      statement_descriptor,
      external_reference,
      notification_url
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ preferenceId: response.body.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
