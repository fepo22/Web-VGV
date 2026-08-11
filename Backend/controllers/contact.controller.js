import Joi from "joi";
import nodemailer from "nodemailer";

// VALIDACIÓN DEL FORMULARIO
const contactSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  correo: Joi.string().trim().email().required(),
  mensaje: Joi.string().trim().min(10).max(2000).required(),
  empresa: Joi.string().allow(""), // honeypot
  token: Joi.string().allow("")
});

const transporter = nodemailer.createTransport({
  host: process.env.CONTACT_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.CONTACT_USER,
    pass: process.env.CONTACT_PASS
  }
});

const CONTACT_EMAIL = "ventas@vgv.cl";

// CONTROLADOR PRINCIPAL
export const sendContact = async (req, res) => {
  const payload = {
    ...req.body,
    correo: req.body?.correo ?? req.body?.email ?? ""
  };

  const { error, value } = contactSchema.validate(payload, { abortEarly: true });
  if (error) {
    return res.status(400).json({
      error: "Datos invalidos",
      detail: error.details[0].message
    });
  }

  // Honeypot (si el bot llena este campo, ignoramos)
  if (value.empresa && value.empresa.trim() !== "") {
    return res.status(200).json({ ok: true, message: "Recibido" });
  }

  try {
    if (!process.env.CONTACT_HOST || !process.env.CONTACT_USER || !process.env.CONTACT_PASS) {
      return res.status(500).json({ error: "Configuracion de correo incompleta en el servidor" });
    }

    const mailOptions = {
      from: `"VGV SPA Web" <${process.env.CONTACT_USER}>`,
      to: CONTACT_EMAIL,
      subject: `Nueva consulta de ${value.nombre}`,
      text: `
Nombre: ${value.nombre}
Correo: ${value.correo}

Mensaje:
${value.mensaje}
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ ok: true, message: "Consulta enviada correctamente" });
  } catch (err) {
    console.error("Error enviando correo:", err.message);
    res.status(500).json({ error: "No se pudo enviar el mensaje" });
  }
};


