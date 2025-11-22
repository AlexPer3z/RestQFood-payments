import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mercadopago from "mercadopago";
import mysql from "mysql2/promise";
import fetch from "node-fetch";
import crypto from "crypto";


const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔹 Configuración de MercadoPago
const MY_ACCESS_TOKEN = "APP_USR-6437200091418350-091312-ebf83f1b75b73b503d382653ed4fc8cf-237587532";
mercadopago.configure({ access_token: MY_ACCESS_TOKEN });

// 🔹 Conexión MySQL
let db;

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() AS fecha, DATABASE() AS db, USER() AS user");
    res.json({ ok: true, result: rows[0] });
  } catch (err) {
    console.error("❌ Error conectando a la BD:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🔹 Crear preferencia de pago
app.post("/create_preference", async (req, res) => {
  try {
    const { items, back_urls, notification_url } = req.body;
    if (!items?.length || !back_urls || !notification_url)
      return res.status(400).json({ error: "Datos incompletos" });

    const preferences = [];

    // 🔹 Función auxiliar: generar código único de 6 dígitos
    async function generarCodigoUnico() {
      let codigo;
      let existe = true;
      while (existe) {
        // genera número aleatorio entre 100000 y 999999
        codigo = Math.floor(100000 + Math.random() * 900000);
        const [rows] = await db.query("SELECT id FROM reservas WHERE codigo = ?", [codigo]);
        if (rows.length === 0) existe = false;
      }
      return codigo;
    }

    for (const item of items) {
      const productId = item.product_id;
      const ownerId = item.owner_id;

      if (!item.mp_access_token || !productId || !ownerId) continue;

      const unitPrice = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad) || 1;
      const total = unitPrice * cantidad;
      const marketplace_fee = parseFloat((total * 0.2).toFixed(2));

      const preferenceData = {
  items: [
    {
      title: item.nombre,
      quantity: cantidad,
      unit_price: unitPrice,
      currency_id: "ARS",
      metadata: {
        product_id: String(productId),
        owner_id: String(ownerId),
      },
    },
  ],
  back_urls,
  auto_return: "approved",
  marketplace_fee,
  notification_url,
  metadata: { // 🔹 metadata global
    buyer_id: String(item.buyer_id),
    product_id: String(productId),
    owner_id: String(ownerId),
  },
  external_reference: String(item.buyer_id),
};


      try {
        const preference = await mercadopago.preferences.create(preferenceData, {
          access_token: item.mp_access_token,
        });

        console.log("✅ Preferencia creada:", {
          productId,
          ownerId,
          preferenceId: preference.response.id,
          init_point: preference.response.init_point,
        });

        // 🔹 Verificar si ya existe una reserva pendiente
        const [existing] = await db.query(
          "SELECT id FROM reservas WHERE buyer_id = ? AND product_id = ? AND estado = 'pendiente'",
          [item.buyer_id, productId]
        );

        if (existing.length > 0) {
          console.log(`⚠️ Ya existe una reserva pendiente para buyer ${item.buyer_id} y producto ${productId}, se eliminará y reemplazará`);
          await db.query(
            "DELETE FROM reservas WHERE buyer_id = ? AND product_id = ? AND estado = 'pendiente'",
            [item.buyer_id, productId]
          );
        }

        // 🔹 Generar código único de 6 dígitos
        const codigo = await generarCodigoUnico();

        // 🔹 Crear nueva reserva con ese código
        await db.query(
  "INSERT INTO reservas (producto, buyer_id, product_id, owner_id, cantidad, estado, codigo, created_at) VALUES (?, ?, ?, ?, ?, 'pendiente', ?, NOW())",
  [item.nombre, item.buyer_id, productId, ownerId, cantidad, codigo]
);


        console.log(`✅ Nueva reserva creada con código ${codigo} para buyer ${item.buyer_id} y producto ${productId}`);

        preferences.push({
          user_id: ownerId,
          preferenceId: preference.response.id,
          init_point: preference.response.init_point,
        });
      } catch (err) {
        console.error("❌ Error creando preferencia o guardando reserva:", err);
      }
    }

    if (!preferences.length)
      return res.status(500).json({ error: "No se pudieron crear preferencias" });

    res.json({ preferences });
  } catch (err) {
    console.error("❌ Error general creando preferencias:", err);
    res.status(500).json({ error: "Error creando preferencias" });
  }
});

// 🔹 Webhook para pagos aprobados
app.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === "payment" && data?.id) {
      const payment = await mercadopago.payment.findById(data.id);
      console.log("📦 Payment webhook:", JSON.stringify(payment.body, null, 2));

      if (payment.body.status === "approved") {
        // Obtener buyer_id
const buyer_id = payment.body.metadata?.buyer_id || payment.body.external_reference;
const product_id = payment.body.metadata?.product_id || payment.body.order?.items?.[0]?.metadata?.product_id;

if (!buyer_id || !product_id) {
  console.warn("⚠️ No se encontró buyer_id o product_id en el pago");
  return res.status(400).send("Faltan datos en el pago");
}


        // 🔹 Traer la reserva pendiente específica
        const [reservas] = await db.query(
          "SELECT id, product_id, cantidad, owner_id FROM reservas WHERE buyer_id = ? AND product_id = ? AND estado = 'pendiente'",
          [buyer_id, product_id]
        );

        for (const reserva of reservas) {
          // 🔹 Actualizar stock del producto
          await db.query(
            "UPDATE productos SET stock = stock - ? WHERE id = ?",
            [reserva.cantidad, reserva.product_id]
          );

          // 🔹 Marcar reserva como aprobada y guardar payment_id
          await db.query(
            "UPDATE reservas SET estado = 'aprobado', payment_id = ? WHERE id = ?",
            [payment.body.id, reserva.id]
          );

          console.log(`✅ Reserva ${reserva.id} aprobada y stock actualizado del producto ${reserva.product_id}`);

          // 🔹 Crear notificación para el dueño
          await db.query(
            "INSERT INTO notificaciones (user_id, mensaje, created_at, leido) VALUES (?, ?, NOW(), 0)",
            [reserva.owner_id, `¡Tienes una nueva reserva del producto ID ${reserva.product_id}!`]
          );

          console.log(`🔔 Notificación enviada al dueño (ID: ${reserva.owner_id})`);
        }
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error procesando webhook:", err);
    res.status(500).send("Error");
  }
});


// 🔹 Endpoint para reintegro total
app.post("/refund_reserva", async (req, res) => {
  const { reserva_id } = req.body;

  if (!reserva_id)
    return res.status(400).json({ ok: false, error: "Falta reserva_id" });

  try {
    // 🔹 Traer reserva
    const [rows] = await db.query(
      `SELECT r.id, r.payment_id, r.estado, r.owner_id
       FROM reservas r
       WHERE r.id = ?`,
      [reserva_id]
    );

    if (!rows.length)
      return res.status(404).json({ ok: false, error: "Reserva no encontrada" });

    const reserva = rows[0];

    if (reserva.estado !== "aprobado")
      return res.status(400).json({ ok: false, error: "Solo reservas aprobadas" });

    if (!reserva.payment_id)
      return res.status(400).json({ ok: false, error: "No se encontró payment_id" });

    // 🔹 Traer mp_access_token del dueño
    const [restRows] = await db.query(
      "SELECT mp_access_token FROM restaurante WHERE user_id = ?",
      [reserva.owner_id]
    );

    if (!restRows.length || !restRows[0].mp_access_token)
      return res.status(400).json({ ok: false, error: "No se encontró mp_access_token del restaurante" });

    const vendedorToken = restRows[0].mp_access_token;

    // 🔹 Generar Idempotency Key único
const idempotencyKey = crypto.randomUUID();

// 🔹 Reintegro total vía HTTP con X-Idempotency-Key
const refundResponse = await fetch(
  `https://api.mercadopago.com/v1/payments/${reserva.payment_id}/refunds`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${vendedorToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey
    }
  }
);

const refundData = await refundResponse.json();

console.log("✅ Reintegro total realizado:", refundData);


    await db.query(
      "UPDATE reservas SET estado = 'cancelado', soliCancelar = 1 WHERE id = ?",
      [reserva_id]
    );

    res.json({
  ok: true,
  message: "Reintegro total realizado",
  paymentId: reserva.payment_id,
  refundDetails: refundData,
});

  } catch (err) {
    console.error("❌ Error procesando reintegro total:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Redirecciones reales para la app
app.get("/success", (req, res) => {
  res.redirect("https://restqfood.com/redirect/success.html");
});

app.get("/failure", (req, res) => {
  res.redirect("https://restqfood.com/redirect/failure.html");
});

app.get("/pending", (req, res) => {
  res.redirect("https://restqfood.com/redirect/pending.html");
});

// 🔹 Inicializar DB y levantar servidor
async function init() {
  try {
    db = await mysql.createPool({
      host: "srv1897.hstgr.io",
      user: "u402567679_RestQFood",
      password: "BzdH(z`+!HZ+f&2",
      database: "u402567679_RestQFood",
      port: 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    app.listen(PORT, () =>
      console.log(`Servidor corriendo en http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("❌ Error inicializando servidor:", err);
  }
}

init();
