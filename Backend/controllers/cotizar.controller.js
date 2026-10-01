import Joi from "joi";
import mongoose from "mongoose";
import { createMailTransport, getMailConfig, hasMailConfig } from "../config/mail.js";
import { connectProductsDatabase } from "../data/products.store.js";
import { getCustomerFromRequest } from "./customer.controller.js";

const quotationSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  tipoCliente: Joi.string().valid("constructora", "instalador/contratista", "instalador/contratista/arquitecto", "particular").required(),
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
  tipoCliente: String,
  estado: { type: String, enum: ["pendiente", "cotizacion_enviada", "confirmada", "completada", "desistida"], default: "pendiente" },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  historialEstados: [{ estado: String, fecha: Date, actor: String }],
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
Tipo de cliente: ${value.tipoCliente}
Correo: ${value.correo}
Empresa: ${value.empresa}
RUT: ${value.rut}
Teléfono: ${value.contacto}
Dirección: ${value.direccion}

Productos:
${listado}`
    });

    const customer = await getCustomerFromRequest(req);
    await Quotation.create({
      ...value,
      correo: value.correo.toLowerCase(),
      customerId: customer?.profileComplete && customer.email === value.correo.toLowerCase() ? customer._id : null,
      historialEstados: [{ estado: "pendiente", fecha: new Date(), actor: "sistema" }]
    });
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

const allowedTransitions = {
  pendiente: ["cotizacion_enviada", "desistida"],
  cotizacion_enviada: ["confirmada", "desistida"],
  confirmada: ["completada"]
};

export async function updateQuotationStatus(req, res) {
  const { error, value } = Joi.object({
    estado: Joi.string().valid("cotizacion_enviada", "confirmada", "completada", "desistida").required()
  }).validate(req.body);
  if (error || !mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Estado o identificador inválido." });
  }
  try {
    await connectProductsDatabase();
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: "Cotización no encontrada." });
    const current = quotation.estado || "pendiente";
    if (!allowedTransitions[current]?.includes(value.estado)) {
      return res.status(409).json({ error: "No se permite ese cambio de estado." });
    }
    const expectedStatus = current === "pendiente" ? { $in: [null, "pendiente"] } : current;
    const updated = await Quotation.findOneAndUpdate(
      { _id: quotation._id, estado: expectedStatus },
      { $set: { estado: value.estado }, $push: { historialEstados: {
        estado: value.estado, fecha: new Date(), actor: req.user.username || "admin"
      } } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: "El estado cambió. Actualiza la lista." });
    return res.json(updated);
  } catch (statusError) {
    console.error("Error actualizando estado:", statusError);
    return res.status(500).json({ error: "No se pudo actualizar la cotización." });
  }
}

export async function getCustomerQuotations(req, res) {
  if (!req.customer.profileComplete) return res.status(403).json({ error: "Completa tu perfil primero." });
  try {
    await connectProductsDatabase();
    const quotations = await Quotation.find({ $or: [
      { customerId: req.customer._id },
      { customerId: null, correo: req.customer.email }
    ] })
      .collation({ locale: "en", strength: 2 })
      .sort({ createdAt: -1 }).limit(100)
      .select("nombre tipoCliente productos estado historialEstados createdAt updatedAt")
      .lean();
    return res.json(quotations.map(quotation => ({ ...quotation, estado: quotation.estado || "pendiente" })));
  } catch (historyError) {
    console.error("Error consultando historial del cliente:", historyError);
    return res.status(500).json({ error: "No se pudo cargar el historial." });
  }
}
