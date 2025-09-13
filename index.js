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

// 🔹 Configuración de Mercado Pago
mercadopago.configure({
  access_token: process.env.ACCESS_TOKEN
});

app.use(cors());
app.use(bodyParser.json());

// Endpoint para crear preferencia
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

    // Validación básica
    if (!title || !quantity || !price || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
      console.log("❌ Payload incompleto:", req.body);
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    // 🔹 Preferencia
    const preference = {
      items: [
        {
          title,
          unit_price: price,
          quantity
        }
      ],
      back_urls,
      auto_return: 'approved',
      statement_descriptor,
      external_reference,
      notification_url,
      // 🔹 Email de prueba obligatorio en sandbox
      payer: {
        email: "test_user_123456@test.com"
      }
    };

    console.log("💡 Creando preferencia:", JSON.stringify(preference, null, 2));

    // 🔹 Crear preferencia
    const response = await mercadopago.preferences.create(preference);

    console.log("💡 Preferencia creada:", response.body);
    res.json({ preferenceId: response.body.id });

  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
