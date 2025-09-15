const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Tu token de la plataforma (vos cobrás el 20%)
const PLATFORM_ACCESS_TOKEN = "APP_USR-6437200091418350-091312-ebf83f1b75b73b503d382653ed4fc8cf-237587532";

// 🔹 Conexión a la base de datos
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "tu_password",
  database: "tu_base",
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Ruta raíz
app.get('/', (req, res) => {
  res.send("Servidor de Mercado Pago corriendo correctamente");
});

// 🔹 Endpoint crear preferencia
app.post('/create_preference', async (req, res) => {
  try {
    console.log("📦 Request body:", req.body);

    const { items, back_urls, notification_url, userId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No se enviaron productos" });
    }

    // 🔹 Procesamos cada producto
    const mpItems = [];
    let preferenceResponse;

    for (const item of items) {
      // 1. Buscar el user_id dueño del producto
      const [rows] = await pool.query("SELECT user_id FROM productos WHERE id = ?", [item.id]);
      if (!rows.length) throw new Error(`Producto ${item.id} no encontrado`);
      const productOwnerId = rows[0].user_id;

      // 2. Buscar el mp_access_token del restaurante dueño
      const [rowsRest] = await pool.query("SELECT mp_access_token FROM restaurantes WHERE id = ?", [productOwnerId]);
      if (!rowsRest.length) throw new Error(`Restaurante ${productOwnerId} no encontrado`);
      const merchantAccessToken = rowsRest[0].mp_access_token;

      // 3. Crear preferencia individual en la cuenta del comerciante
      mercadopago.configure({ access_token: merchantAccessToken });

      const preferenceData = {
        items: [
          {
            title: item.nombre,
            unit_price: Number(item.precio),
            quantity: Number(item.cantidad),
          },
        ],
        back_urls,
        auto_return: "approved",
        external_reference: userId, // comprador
        notification_url,
        marketplace_fee: (item.precio * item.cantidad) * 0.20, // 💰 tu comisión (20%)
      };

      console.log("💡 Preference data:", preferenceData);

      preferenceResponse = await mercadopago.preferences.create(preferenceData);
      console.log("✅ Preferencia creada en MP:", preferenceResponse.body.id);

      mpItems.push({
        product_id: item.id,
        preferenceId: preferenceResponse.body.id,
        init_point: preferenceResponse.body.init_point,
      });
    }

    res.json({ success: true, preferences: mpItems });

  } catch (error) {
    console.error("❌ Error creando preferencia:", error);
    res.status(500).json({
      error: "Error creando la preferencia",
      details: error.message,
    });
  }
});

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
