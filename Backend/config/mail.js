import nodemailer from "nodemailer";

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function getMailConfig() {
  const host = process.env.SMTP_HOST || process.env.CONTACT_HOST || "";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = toBoolean(process.env.SMTP_SECURE, port === 465);
  const user = process.env.SMTP_USER || process.env.CONTACT_USER || process.env.MAIL_USER || "";
  const pass = process.env.SMTP_PASS || process.env.CONTACT_PASS || process.env.MAIL_PASS || "";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user || "ventas@vgv.cl";
  const fromName = process.env.SMTP_FROM_NAME || "VGV SPA Web";
  const toContact = process.env.SMTP_TO_CONTACT || process.env.MAIL_RECEIVER || "ventas@vgv.cl";
  const toQuotes = process.env.SMTP_TO_QUOTES || process.env.MAIL_RECEIVER || "ventas@vgv.cl";

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    toContact,
    toQuotes
  };
}

export function hasMailConfig(config = getMailConfig()) {
  return Boolean(config.host && config.user && config.pass);
}

export function createMailTransport(config = getMailConfig()) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
}
