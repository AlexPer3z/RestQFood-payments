require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Mercado Pago
mercadopago.configurations.setAccessToken(process.env.ACCESS_TOKEN);

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Endpoint para crear preferencia de pago
app.post('/create_preference', async (req, res) => {
  try {
    // Se reciben todos los datos desde el body de la request
    const { title, quantity, price, email, marketplace_fee, collector_id, back_urls, statement_descriptor, external_reference, notification_url } = req.body;

    if (!title || !quantity || !price || !email || !collector_id || !marketplace_fee || !back_urls || !statement_descriptor || !external_reference || !notification_url) {
      return res.status(400).json({ error: 'Faltan datos obligatorios en la solicitud' });
    }

    const preference = {
      items: [
        {
          title: title,
          unit_price: price,
          quantity: quantity,
        }
      ],
      marketplace_fee: marketplace_fee,
      payer: {
        email: email,
      },
      collector_id: collector_id,
      back_urls: back_urls,
      auto_return: 'approved',
      statement_descriptor: statement_descriptor,
      external_reference: external_reference,
      notification_url: notification_url
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ preferenceId: response.body.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando la preferencia' });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
