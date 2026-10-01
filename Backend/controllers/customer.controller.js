import bcrypt from "bcrypt";
import { parseCookie } from "cookie";
import { createHash, randomBytes } from "node:crypto";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { createMailTransport, getMailConfig, hasMailConfig } from "../config/mail.js";
import { Customer, customerProfileSchema, publicCustomer } from "../data/customers.store.js";
import { connectProductsDatabase } from "../data/products.store.js";

const COOKIE_NAME = "vgv_customer";
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const registerSchema = customerProfileSchema.keys({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(12).max(128).required()
});
const credentialsSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required()
});

function customerSecret() {
  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    throw new Error("Falta CUSTOMER_JWT_SECRET en producción");
  }
  return secret || "vgv-customer-local-dev-only";
}

function siteUrl() {
  const site = process.env.SITE_URL || (!process.env.VERCEL ? "http://localhost:5173" : "");
  if (!site) throw new Error("Falta SITE_URL para enlaces de cuenta");
  return site.replace(/\/$/, "");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}

function setSession(res, customer) {
  const token = jwt.sign(
    { customerId: String(customer._id), sessionVersion: customer.sessionVersion, role: "customer" },
    customerSecret(),
    { expiresIn: "7d", audience: "vgv-customer" }
  );
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_AGE });
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendAccountMail(to, subject, text) {
  const config = getMailConfig();
  if (!hasMailConfig(config)) throw new Error("Configuracion SMTP incompleta");
  await createMailTransport(config).sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to,
    subject,
    text
  });
}

async function issueEmailToken(customer, purpose) {
  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 30 * 60 * 1000);
  if (purpose === "verify") {
    customer.verifyTokenHash = tokenHash(token);
    customer.verifyExpiresAt = expiry;
  } else {
    customer.resetTokenHash = tokenHash(token);
    customer.resetExpiresAt = expiry;
  }
  await customer.save();
  const fragment = purpose === "verify" ? "verificar" : "restablecer";
  const action = purpose === "verify" ? "Verifica tu correo" : "Restablece tu contraseña";
  await sendAccountMail(customer.email, `${action} - VGV`,
    `${action} desde este enlace (válido 30 minutos): ${siteUrl()}/cuenta#${fragment}=${token}`);
}

export async function getCustomerFromRequest(req) {
  try {
    const token = parseCookie(req.headers.cookie || "")[COOKIE_NAME];
    if (!token) return null;
    const payload = jwt.verify(token, customerSecret(), { audience: "vgv-customer" });
    if (payload.role !== "customer") return null;
    await connectProductsDatabase();
    const customer = await Customer.findById(payload.customerId);
    if (!customer || !customer.emailVerified || customer.sessionVersion !== payload.sessionVersion) return null;
    return customer;
  } catch {
    return null;
  }
}

export async function requireCustomer(req, res, next) {
  const customer = await getCustomerFromRequest(req);
  if (!customer) return res.status(401).json({ error: "Inicia sesión con una cuenta verificada." });
  req.customer = customer;
  next();
}

export async function registerCustomer(req, res) {
  const { error, value } = registerSchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ error: "Revisa los datos de tu cuenta." });
  try {
    customerSecret();
    siteUrl();
    if (!hasMailConfig()) return res.status(503).json({ error: "Registro por correo no disponible temporalmente." });
    await connectProductsDatabase();
    const email = value.email.toLowerCase();
    if (await Customer.exists({ email })) return res.status(409).json({ error: "Ese correo ya tiene una cuenta." });
    const { password, ...profile } = value;
    const customer = await Customer.create({
      ...profile,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      profileComplete: true
    });
    await issueEmailToken(customer, "verify");
    return res.status(201).json({ ok: true, message: "Revisa tu correo para activar la cuenta." });
  } catch (registrationError) {
    if (registrationError.code === 11000) return res.status(409).json({ error: "Ese correo ya tiene una cuenta." });
    console.error("Error registrando cliente:", registrationError);
    return res.status(500).json({ error: "No se pudo crear la cuenta. Inténtalo más tarde." });
  }
}

export async function verifyCustomer(req, res) {
  const token = String(req.body?.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: "Enlace inválido." });
  try {
    await connectProductsDatabase();
    const customer = await Customer.findOneAndUpdate(
      { verifyTokenHash: tokenHash(token), verifyExpiresAt: { $gt: new Date() } },
      { $set: { emailVerified: true }, $unset: { verifyTokenHash: "", verifyExpiresAt: "" } },
      { new: true }
    );
    if (!customer) return res.status(400).json({ error: "El enlace expiró o ya fue utilizado." });
    setSession(res, customer);
    return res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (verificationError) {
    console.error("Error verificando cuenta:", verificationError);
    return res.status(500).json({ error: "No se pudo verificar la cuenta." });
  }
}

export async function loginCustomer(req, res) {
  const { error, value } = credentialsSchema.validate(req.body);
  if (error) return res.status(400).json({ error: "Email y contraseña son obligatorios." });
  try {
    await connectProductsDatabase();
    const customer = await Customer.findOne({ email: value.email.toLowerCase() });
    if (!customer?.passwordHash || !(await bcrypt.compare(value.password, customer.passwordHash))) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }
    if (!customer.emailVerified) return res.status(403).json({ error: "Verifica tu correo antes de ingresar." });
    setSession(res, customer);
    return res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (loginError) {
    console.error("Error iniciando sesión de cliente:", loginError);
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
}

export async function resendVerification(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!Joi.string().email().validate(email).error) {
    try {
      await connectProductsDatabase();
      const customer = await Customer.findOne({ email, emailVerified: false });
      if (customer) await issueEmailToken(customer, "verify");
    } catch (error) {
      console.error("Error reenviando verificación:", error);
    }
  }
  return res.json({ ok: true, message: "Si hay una cuenta pendiente, enviaremos un nuevo enlace." });
}

export async function forgotPassword(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!Joi.string().email().validate(email).error) {
    try {
      await connectProductsDatabase();
      const customer = await Customer.findOne({ email, emailVerified: true });
      if (customer?.passwordHash) await issueEmailToken(customer, "reset");
    } catch (error) {
      console.error("Error solicitando recuperación:", error);
    }
  }
  return res.json({ ok: true, message: "Si existe la cuenta, enviaremos instrucciones a su correo." });
}

export async function resetPassword(req, res) {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!/^[a-f0-9]{64}$/.test(token) || Joi.string().min(12).max(128).validate(password).error) {
    return res.status(400).json({ error: "Enlace o contraseña inválidos." });
  }
  try {
    await connectProductsDatabase();
    const customer = await Customer.findOneAndUpdate(
      { resetTokenHash: tokenHash(token), resetExpiresAt: { $gt: new Date() } },
      { $set: { passwordHash: await bcrypt.hash(password, 12) }, $inc: { sessionVersion: 1 },
        $unset: { resetTokenHash: "", resetExpiresAt: "" } },
      { new: true }
    );
    if (!customer) return res.status(400).json({ error: "El enlace expiró o ya fue utilizado." });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return res.json({ ok: true });
  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    return res.status(500).json({ error: "No se pudo restablecer la contraseña." });
  }
}

async function googleIdentity(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new Error("Falta GOOGLE_CLIENT_ID");
  const ticket = await new OAuth2Client(audience).verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (!payload?.email_verified || !payload?.sub || !payload?.email) throw new Error("Cuenta Google sin correo verificado");
  return payload;
}

export async function googleCustomer(req, res) {
  const credential = String(req.body?.credential || "");
  if (!credential) return res.status(400).json({ error: "Falta credencial de Google." });
  try {
    const identity = await googleIdentity(credential);
    await connectProductsDatabase();
    let customer = await Customer.findOne({ googleSub: identity.sub });
    if (!customer) {
      const email = identity.email.toLowerCase();
      if (await Customer.exists({ email })) {
        return res.status(409).json({ error: "Este correo ya tiene cuenta. Ingresa con contraseña y conecta Google desde tu perfil." });
      }
      customer = await Customer.create({
        email,
        googleSub: identity.sub,
        emailVerified: true,
        nombre: identity.name || "",
        profileComplete: false
      });
    }
    setSession(res, customer);
    return res.json({ ok: true, customer: publicCustomer(customer) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "Este correo ya tiene cuenta." });
    console.error("Error de inicio con Google:", error.message);
    return res.status(401).json({ error: "No se pudo verificar la cuenta de Google." });
  }
}

export async function linkGoogleCustomer(req, res) {
  try {
    const identity = await googleIdentity(String(req.body?.credential || ""));
    if (identity.email.toLowerCase() !== req.customer.email) {
      return res.status(400).json({ error: "El correo de Google debe coincidir con tu cuenta." });
    }
    if (await Customer.exists({ googleSub: identity.sub, _id: { $ne: req.customer._id } })) {
      return res.status(409).json({ error: "Esta cuenta Google ya está vinculada." });
    }
    req.customer.googleSub = identity.sub;
    await req.customer.save();
    return res.json({ ok: true, customer: publicCustomer(req.customer) });
  } catch (error) {
    console.error("Error vinculando Google:", error.message);
    return res.status(400).json({ error: "No se pudo vincular Google." });
  }
}

export async function saveCustomerProfile(req, res) {
  const { error, value } = customerProfileSchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ error: "Completa todos los datos obligatorios del perfil." });
  try {
    Object.assign(req.customer, value, { profileComplete: true });
    await req.customer.save();
    return res.json({ ok: true, customer: publicCustomer(req.customer) });
  } catch (saveError) {
    console.error("Error guardando perfil:", saveError);
    return res.status(500).json({ error: "No se pudo guardar el perfil." });
  }
}

export async function logoutCustomer(req, res) {
  const customer = await getCustomerFromRequest(req);
  if (customer) {
    customer.sessionVersion += 1;
    await customer.save();
  }
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
}

export function getCustomerProfile(req, res) {
  res.json({ customer: publicCustomer(req.customer) });
}