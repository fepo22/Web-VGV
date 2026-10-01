import Joi from "joi";
import mongoose from "mongoose";
import { createMailTransport, getMailConfig, hasMailConfig } from "../config/mail.js";
import { connectProductsDatabase } from "../data/products.store.js";

const quotationSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  correo: Joi.string().trim().email().required(),
  empresa: Joi.string().trim().max(100).allow("").default(""),
  rut: Joi.string().trim().max(30).allow("").default(""),
  contacto: Joi.string().trim().max(50).allow("").default(""),
  direccion: Joi.string().trim().max(200).allow("").default(""),
  productos: Joi.array().min(1).max(100).items(Joi.object({
    id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    nombre: Joi.string().trim().max(200).required(),
    cantidad: Joi.number().integer().min(1).required(),
    varianteSku: Joi.string().max(100).allow("", null),
    varianteMedida: Joi.string().max(100).allow("", null)
  })).required()
});

const Quotation = mongoose.models.Quotation || mongoose.model("Quotation", new mongoose.Schema({
  nombre: String,
  correo: String,
  empresa: String,
  rut: String,
  contacto: String,
  direccion: String,
  productos: [{ id: String, nombre: String, cantidad: Number, varianteSku: String, varianteMedida: String }]
}, { timestamps: true }));

export const sendQuotation = async (req, res) => {
  const { error, value } = quotationSchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ error: "Datos de cotización inválidos", detail: error.details[0].message });

  const listado = value.productos.map(producto =>
    `- ${producto.nombre} (SKU: ${producto.varianteSku || producto.id}) x ${producto.cantidad}`
  ).join("\n");

  try {
    await connectProductsDatabase();
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
Nombre: ${value.nombre}
Correo: ${value.correo}
Empresa: ${value.empresa}
RUT: ${value.rut}
Teléfono: ${value.contacto}
Dirección: ${value.direccion}

Productos:
${listado}`
    });

    await Quotation.create(value);
    res.status(200).json({ ok: true, message: "Cotización enviada correctamente" });
  } catch (err) {
    console.error("Error procesando cotización:", err);
    res.status(500).json({ error: "No se pudo registrar la cotización; contacta a ventas si recibiste el correo" });
  }
};

export const getQuotations = async (req, res) => {
  try {
    await connectProductsDatabase();
    const quotations = await Quotation.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(quotations);
  } catch (err) {
    console.error("Error consultando cotizaciones:", err);
    res.status(500).json({ error: "No se pudieron consultar las cotizaciones" });
  }
};
