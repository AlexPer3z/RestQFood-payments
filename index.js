// index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Verificamos el ACCESS_TOKEN
if (!process.env.ACCESS_TOKEN) {
  console.error("❌ ACCESS_TOKEN no definido");
  process.exit(1);
} else {
  console.log("✅ ACCESS_TOKEN detectado correctamente");
}

// 🔹 Nuevo cliente de MP (v2)
const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN
});

const preference = new mercadopago.Preference(client);

app.use(cors());
app.use(bodyParser.json());

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

    if (!title || !quantity || !price || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
      console.log("❌ Payload incompleto:", req.body);
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    const preferenceData = {
      items: [
        {
          title,
          unit_price: Number(price),
          quantity: Number(quantity)
        }
      ],
      back_urls,
      auto_return: 'approved',
      statement_descriptor,
      external_reference,
      notification_url,
      payer: {
        email: "test_user_123456@test.com" // obligatorio en sandbox
      }
    };

    console.log("💡 Creando preferencia:", JSON.stringify(preferenceData, null, 2));

    // 🔹 Usamos la nueva API v2
    const response = await preference.create({ body: preferenceData });

    console.log("💡 Preferencia creada:", response);
    res.json({ preferenceId: response.id });

  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
