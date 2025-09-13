// index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Verificamos el ACCESS_TOKEN de tu app (marketplace)
if (!process.env.ACCESS_TOKEN) {
  console.error("❌ ACCESS_TOKEN no definido");
  process.exit(1);
} else {
  console.log("✅ ACCESS_TOKEN detectado correctamente");
}

// 🔹 Configuración nueva SDK (v2)
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
      notification_url,
      collector_id, // <- ID del vendedor (comercio)
      commission    // <- % que te queda a vos
    } = req.body;

    // Validación
    if (!title || !quantity || !price || !back_urls || !statement_descriptor || !external_reference || !notification_url || !collector_id) {
      console.log("❌ Payload incompleto:", req.body);
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    // 💰 Calculamos tu comisión
    const total = Number(price) * Number(quantity);
    const marketplace_fee = commission
      ? Math.round((total * Number(commission)) / 100) // porcentaje
      : 0;

    // 🔹 Datos de la preferencia
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
      marketplace_fee,  // 💡 tu comisión en ARS
      collector_id,     // 💡 comercio al que se le acredita el resto
      payer: {
        email: "test_user_123456@test.com" // sandbox (en producción el email real del comprador)
      }
    };

    console.log("💡 Creando preferencia:", JSON.stringify(preferenceData, null, 2));

    // Crear preferencia
    const response = await preference.create({ body: preferenceData });

    console.log("💡 Preferencia creada:", response);
    res.json({ preferenceId: response.id, init_point: response.init_point });

  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
