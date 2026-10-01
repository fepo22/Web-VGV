import Joi from "joi";
import mongoose from "mongoose";

export const customerProfileSchema = Joi.object({
  tipoCliente: Joi.string().valid("constructora", "instalador/contratista/arquitecto", "particular").required(),
  nombre: Joi.string().trim().min(3).max(100).required(),
  empresa: Joi.when("tipoCliente", {
    is: "constructora",
    then: Joi.string().trim().min(2).max(100).required(),
    otherwise: Joi.string().trim().max(100).allow("").default("")
  }),
  rut: Joi.string().trim().min(7).max(20).required(),
  direccionComercial: Joi.string().trim().min(5).max(200).required(),
  direccionDespacho: Joi.string().trim().min(5).max(200).required(),
  telefono: Joi.string().trim().min(7).max(30).required()
});

const customerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  googleSub: { type: String, unique: true, sparse: true },
  emailVerified: { type: Boolean, default: false },
  profileComplete: { type: Boolean, default: false },
  tipoCliente: String,
  nombre: String,
  empresa: String,
  rut: String,
  direccionComercial: String,
  direccionDespacho: String,
  telefono: String,
  verifyTokenHash: String,
  verifyExpiresAt: Date,
  resetTokenHash: String,
  resetExpiresAt: Date,
  sessionVersion: { type: Number, default: 0 }
}, { timestamps: true });

export const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

export function publicCustomer(customer) {
  return {
    email: customer.email,
    emailVerified: customer.emailVerified,
    profileComplete: customer.profileComplete,
    tipoCliente: customer.tipoCliente || "",
    nombre: customer.nombre || "",
    empresa: customer.empresa || "",
    rut: customer.rut || "",
    direccionComercial: customer.direccionComercial || "",
    direccionDespacho: customer.direccionDespacho || "",
    telefono: customer.telefono || "",
    googleConnected: Boolean(customer.googleSub),
    hasPassword: Boolean(customer.passwordHash)
  };
}