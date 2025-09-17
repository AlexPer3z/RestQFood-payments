import mysql from "mysql2/promise";

// 🔹 Conexión MySQL a Hostinger
const db = await mysql.createPool({
  host: "srv1897.hstgr.io", // o 193.203.175.239
  user: "u402567679_RestQFood",
  password: "BzdH(z`+!HZ+f&2",
  database: "u402567679_RestQFood",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() AS fecha, DATABASE() AS db, USER() AS user");
    res.json({ ok: true, result: rows[0] });
  } catch (err) {
    console.error("❌ Error conectando a la BD:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});




// backend/index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mercadopago from "mercadopago";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 🔹 Configuramos tu token principal para cobrar comisión
const MY_ACCESS_TOKEN = "APP_USR-6437200091418350-091312-ebf83f1b75b73b503d382653ed4fc8cf-237587532";
mercadopago.configure({ access_token: MY_ACCESS_TOKEN });

app.post("/create_preference", async (req, res) => {
  try {
    const { items, back_urls, notification_url } = req.body;

    console.log("📥 Request received:", req.body);

    if (!items || !items.length || !back_urls || !notification_url) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const preferences = [];

    for (const item of items) {
      console.log("🔹 Procesando item:", item);

      if (!item.mp_access_token) {
        console.error(`⚠️ No hay mp_access_token para user_id ${item.user_id}`);
        continue;
      }

      const unitPrice = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad) || 1;
      const total = unitPrice * cantidad;
      const marketplace_fee = parseFloat((total * 0.20).toFixed(2)); // 20% para vos

      const preferenceData = {
        items: [
          {
            title: item.nombre,
            quantity: cantidad,
            unit_price: unitPrice,
            currency_id: "ARS",
          },
        ],
        back_urls,
        auto_return: "approved",
        marketplace_fee,
        notification_url,
      };

      console.log("📝 PreferenceData:", preferenceData);
      console.log("💳 Token del vendedor:", item.mp_access_token);

      try {
        // v1 permite pasar token distinto por item
        const preference = await mercadopago.preferences.create(preferenceData, { access_token: item.mp_access_token });

        console.log("✅ Preferencia creada:", preference.response);

        preferences.push({
          user_id: item.user_id,
          preferenceId: preference.response.id,
          init_point: preference.response.init_point,
        });
      } catch (err) {
        console.error("❌ Error creando preferencia para item:", preferenceData, err);
      }
    }

    if (!preferences.length) {
      return res.status(500).json({ error: "No se pudieron crear preferencias" });
    }

    res.json({ preferences });
  } catch (error) {
    console.error("❌ Error general creando preferencias:", error);
    res.status(500).json({ error: "Error creando preferencias" });
  }
});

// 🔹 Webhook y back URLs de prueba
app.post("/webhook", (req, res) => {
  console.log("📩 Notificación recibida:", req.body);
  res.status(200).send("OK");
});

app.get("/success", (req, res) => res.send("Pago aprobado ✅"));
app.get("/failure", (req, res) => res.send("Pago fallido ❌"));
app.get("/pending", (req, res) => res.send("Pago pendiente ⏳"));

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
