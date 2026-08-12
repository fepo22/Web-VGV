import { createMailTransport, getMailConfig, hasMailConfig } from "../config/mail.js";

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
    const mailConfig = getMailConfig();
    if (!hasMailConfig(mailConfig)) {
      return res.status(500).json({ error: "Configuracion de correo incompleta en el servidor" });
    }

    const transporter = createMailTransport(mailConfig);

    await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.fromEmail}>`,
      to: mailConfig.toQuotes,
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
