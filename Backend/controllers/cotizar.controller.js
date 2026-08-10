import nodemailer from "nodemailer";

export const sendQuotation = async (req, res) => {
  const { nombre, correo, empresa, productos } = req.body;

  if (!productos || productos.length === 0) {
    return res.status(400).json({ error: "No hay productos" });
  }

  if (!nombre || !correo) {
    return res.status(400).json({ error: "Faltan datos del cliente" });
  }

  const listado = productos
    .map(p => `• ${p.nombre} (${p.categoria})`)
    .join("\n");

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"VGV SPA Web" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_RECEIVER,
      subject: "Nueva cotización desde la web",
      text: `Cotización solicitada por:
Nombre: ${nombre}
Correo: ${correo}
Empresa: ${empresa || "No especificada"}

Productos:
${listado}`
    });

    res.status(200).json({ ok: true, message: "Cotización enviada correctamente" });
  } catch (err) {
    console.error("❌ Error enviando correo:", err);
    res.status(500).json({ error: "Error enviando correo" });
  }
};
