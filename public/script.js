// ===============================
// VGV SPA - Script Frontend Optimizado
// ===============================

const CONTACT_INFO = {
  email: "ventas@vgv.cl",
  whatsapp: "56934052194",
  phone: ""
};

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1"];
const CATALOG_ROUTE_PREFIXES = ["/catalogo", "/producto", "/carrito", "/checkout", "/admin"];

const DEPRECATED_SECTION_LINKS = {
  "calefactore.html": "/catalogo?linea=calefont-calefaccion",
  "calefactores.html": "/catalogo?linea=calefont-calefaccion",
  "calefaccion.html": "/catalogo?linea=calefont-calefaccion",
  "canalizacion.html": "/catalogo?linea=canalizacion",
  "pegamentos.html": "/catalogo?linea=pegamentos-cementos",
  "griferias.html": "/catalogo?linea=griferias-sanitarios"
};

function normalizeDeprecatedLegacyLinks() {
  document.querySelectorAll("a[href]").forEach(anchor => {
    const href = (anchor.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    const baseHref = href.split(/[?#]/)[0].toLowerCase();
    const normalizedBase = baseHref.startsWith("/") ? baseHref.slice(1) : baseHref;
    const replacement = DEPRECATED_SECTION_LINKS[normalizedBase];

    if (replacement) {
      anchor.setAttribute("href", replacement);
    }
  });
}

function getCatalogAppBaseUrl() {
  if (!LOCAL_HOSTNAMES.includes(window.location.hostname)) return "";
  if (window.location.port === "5173") return "";
  return "http://localhost:5173";
}

function normalizeCatalogLinksForLocal() {
  const baseUrl = getCatalogAppBaseUrl();
  if (!baseUrl) return;

  document.querySelectorAll('a[href^="/"]').forEach(anchor => {
    const href = anchor.getAttribute("href") || "";
    if (!CATALOG_ROUTE_PREFIXES.some(prefix => href.startsWith(prefix))) return;

    anchor.setAttribute("href", `${baseUrl}${href}`);
  });
}

function applyContactInfo() {
  document.querySelectorAll('a[href^="mailto:"]').forEach(anchor => {
    anchor.setAttribute("href", `mailto:${CONTACT_INFO.email}`);
    if (!anchor.textContent.trim() || anchor.textContent.includes("@")) {
      anchor.textContent = CONTACT_INFO.email;
    }
  });

  document.querySelectorAll('a[href*="wa.me/"]').forEach(anchor => {
    anchor.setAttribute("href", `https://wa.me/${CONTACT_INFO.whatsapp}`);
  });

  const hasPhone = Boolean(CONTACT_INFO.phone && CONTACT_INFO.phone.trim());
  const telAnchors = document.querySelectorAll('a[href^="tel:"]');

  telAnchors.forEach(anchor => {
    if (hasPhone) {
      anchor.setAttribute("href", `tel:${CONTACT_INFO.phone}`);
      anchor.textContent = CONTACT_INFO.phone;
      return;
    }

    const block = anchor.closest("p, .contact-card, .btn-contacto, li");
    if (block && block !== anchor) {
      block.style.display = "none";
    } else {
      anchor.style.display = "none";
    }
  });
}

function optimizeLegacyImages() {
  const images = Array.from(document.querySelectorAll("img"));

  images.forEach((img, index) => {
    const inTopBar = Boolean(img.closest("header, nav"));
    const eager = inTopBar || index < 2;

    if (!img.hasAttribute("loading")) {
      img.setAttribute("loading", eager ? "eager" : "lazy");
    }

    if (!img.hasAttribute("decoding")) {
      img.setAttribute("decoding", "async");
    }

    if (!img.hasAttribute("fetchpriority")) {
      img.setAttribute("fetchpriority", eager ? "high" : "low");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    normalizeDeprecatedLegacyLinks();
    normalizeCatalogLinksForLocal();
    optimizeLegacyImages();
    applyContactInfo();
  });
} else {
  normalizeDeprecatedLegacyLinks();
  normalizeCatalogLinksForLocal();
  optimizeLegacyImages();
  applyContactInfo();
}

// ===============================
// NAVBAR STICKY
// ===============================
const header = document.querySelector("header");
if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("sticky", window.scrollY > 50);
  });
}

// ===============================
// SCROLL SUAVE
// ===============================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", e => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// ===============================
// ANIMACIONES (fade-in)
// ===============================
const observer = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  }),
  { threshold: 0.2 }
);

document.querySelectorAll("section, .card, .stat").forEach(el => {
  el.classList.add("fade-in");
  observer.observe(el);
});

// ===============================
// BOTÓN VOLVER ARRIBA
// ===============================
const btnTop = document.createElement("button");
btnTop.innerText = "↑";
btnTop.id = "btnTop";
btnTop.style.display = "none";
document.body.appendChild(btnTop);

btnTop.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" })
);

window.addEventListener("scroll", () => {
  btnTop.style.display = window.scrollY > 300 ? "block" : "none";
});

// ===============================
// CARRUSEL INFINITO
// ===============================
const track = document.querySelector(".carousel-track");
const btnLeft = document.querySelector(".carousel-btn.left");
const btnRight = document.querySelector(".carousel-btn.right");

if (track && btnLeft && btnRight && track.children.length) {
  const items = Array.from(track.children);
  items.forEach(item => track.appendChild(item.cloneNode(true)));

  const getStep = () => {
    const first = track.children[0];
    if (!first) return 0;
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.gap || styles.columnGap || "0") || 0;
    return first.getBoundingClientRect().width + gap;
  };

  const getOriginalWidth = () => items.length * getStep();

  const move = dir => {
    const step = getStep();
    const originalWidth = getOriginalWidth();
    if (!step || !originalWidth) return;

    track.scrollBy({ left: dir * step, behavior: "smooth" });
    setTimeout(() => {
      if (track.scrollLeft >= originalWidth) track.scrollLeft = 0;
      if (track.scrollLeft <= 0) track.scrollLeft = originalWidth;
    }, 350);
  };

  btnRight.addEventListener("click", () => move(1));
  btnLeft.addEventListener("click", () => move(-1));
  setInterval(() => move(1), 3000);
}

// ===============================
// FORMULARIO DE CONTACTO
// ===============================
const formContacto = document.getElementById("form-contacto");
const toastContacto = document.getElementById("toast-contacto");
const tokenInput = document.getElementById("token");
const formStatus = document.getElementById("form-status");
const btnEnviarContacto = document.getElementById("btn-enviar-contacto");
const nombreInput = document.getElementById("nombre");
const correoInput = document.getElementById("correo");
const mensajeInput = document.getElementById("mensaje");
const mensajeCounter = document.getElementById("contador-mensaje");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errorNodes = {
  nombre: document.getElementById("error-nombre"),
  correo: document.getElementById("error-correo"),
  mensaje: document.getElementById("error-mensaje")
};

let toastTimeout;

function getContactApiUrl() {
  const isLocalPreview = LOCAL_HOSTNAMES.includes(window.location.hostname);
  if (isLocalPreview && window.location.port && window.location.port !== "3000") {
    return "http://localhost:3000/api/contacto";
  }

  return "/api/contacto";
}

function showToast(message, type = "success") {
  if (!toastContacto) return;

  toastContacto.textContent = message;
  toastContacto.classList.remove("toast-info", "toast-success", "toast-error", "show");
  toastContacto.classList.add(
    type === "error" ? "toast-error" : type === "info" ? "toast-info" : "toast-success"
  );

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  requestAnimationFrame(() => {
    toastContacto.classList.add("show");
  });

  toastTimeout = setTimeout(() => {
    toastContacto.classList.remove("show");
  }, 3600);
}

function normalizeName(name) {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(part => {
      if (!part) return "";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function trackContactConversion(payload) {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", {
        event_category: "contacto",
        event_label: "formulario_contacto",
        value: 1
      });
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "contact_form_success",
        form_name: "contacto",
        lead_email_domain: (payload.correo.split("@")[1] || "").toLowerCase()
      });
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "Lead", {
        content_name: "Formulario Contacto",
        status: "success"
      });
    }
  } catch (error) {
    console.warn("No se pudo registrar el evento de conversion:", error);
  }
}

function setFormStatus(message, type = "info") {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.classList.remove("is-info", "is-success", "is-error");
  if (type === "success") formStatus.classList.add("is-success");
  else if (type === "error") formStatus.classList.add("is-error");
  else formStatus.classList.add("is-info");
}

function setFieldError(field, message) {
  const input = document.getElementById(field);
  const error = errorNodes[field];
  if (!input || !error) return;

  error.textContent = message || "";
  input.classList.toggle("input-error", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateNombre(value) {
  if (value.length < 3) return "Ingresa al menos 3 caracteres.";
  if (value.length > 100) return "El nombre no puede superar 100 caracteres.";
  return "";
}

function validateCorreo(value) {
  if (!value) return "El correo es obligatorio.";
  if (!emailRegex.test(value)) return "Ingresa un correo valido.";
  return "";
}

function validateMensaje(value) {
  if (value.length < 10) return "El mensaje debe tener al menos 10 caracteres.";
  if (value.length > 2000) return "El mensaje no puede superar 2000 caracteres.";
  return "";
}

function updateCounter() {
  if (!mensajeInput || !mensajeCounter) return;
  const currentLength = mensajeInput.value.trim().length;
  mensajeCounter.textContent = `${currentLength} / 2000`;
}

function setSubmitState(isSending) {
  if (!btnEnviarContacto) return;
  btnEnviarContacto.disabled = isSending;
  btnEnviarContacto.textContent = isSending ? "Enviando..." : "Enviar";
}

function refreshToken() {
  if (tokenInput) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      tokenInput.value = window.crypto.randomUUID();
      return;
    }

    tokenInput.value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

refreshToken();

if (formContacto) {
  const sanitizeInput = value => String(value ?? "").replace(/[<>]/g, "");
  let lastSubmit = 0;

  updateCounter();

  if (nombreInput) {
    nombreInput.addEventListener("input", () => {
      const value = sanitizeInput(nombreInput.value);
      setFieldError("nombre", validateNombre(value));
    });

    nombreInput.addEventListener("blur", () => {
      const normalizado = normalizeName(sanitizeInput(nombreInput.value));
      nombreInput.value = normalizado;
      setFieldError("nombre", validateNombre(normalizado));
    });
  }

  if (correoInput) {
    correoInput.addEventListener("input", () => {
      const value = sanitizeInput(correoInput.value).trim();
      setFieldError("correo", validateCorreo(value));
    });
  }

  if (mensajeInput) {
    mensajeInput.addEventListener("input", () => {
      const value = sanitizeInput(mensajeInput.value).trim();
      updateCounter();
      setFieldError("mensaje", validateMensaje(value));
    });
  }

  formContacto.addEventListener("submit", async function (e) {
    e.preventDefault();
    setFormStatus("");

    const now = Date.now();
    if (now - lastSubmit < 5000) {
      setFormStatus("Espera unos segundos antes de enviar nuevamente.", "error");
      return;
    }

    const datos = new FormData(formContacto);
    const nombre = normalizeName(sanitizeInput(datos.get("nombre")));
    const correo = sanitizeInput(datos.get("correo")).trim();
    const mensaje = sanitizeInput(datos.get("mensaje")).trim();
    const empresa = sanitizeInput(datos.get("empresa")).trim();
    const token = String(datos.get("token") ?? "").trim();

    const errorNombre = validateNombre(nombre);
    const errorCorreo = validateCorreo(correo);
    const errorMensaje = validateMensaje(mensaje);

    setFieldError("nombre", errorNombre);
    setFieldError("correo", errorCorreo);
    setFieldError("mensaje", errorMensaje);

    if (errorNombre || errorCorreo || errorMensaje) {
      setFormStatus("Revisa los campos marcados antes de enviar.", "error");
      showToast("Revisa los campos marcados para continuar.", "error");
      return;
    }

    if (!token) {
      refreshToken();
    }

    lastSubmit = now;
    setSubmitState(true);
    setFormStatus("Enviando tu mensaje...", "info");

    const payload = {
      nombre,
      correo,
      mensaje,
      empresa,
      token: tokenInput?.value ?? ""
    };

    if (nombreInput) {
      nombreInput.value = nombre;
    }

    try {
      const respuesta = await fetch(getContactApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await respuesta.json().catch(() => null);

      if (respuesta.ok && data?.ok) {
        setFormStatus("Mensaje enviado correctamente. Te responderemos pronto.", "success");
        showToast("Gracias, tu mensaje fue enviado correctamente.", "success");
        trackContactConversion(payload);
        formContacto.reset();
        refreshToken();
        updateCounter();
        setFieldError("nombre", "");
        setFieldError("correo", "");
        setFieldError("mensaje", "");
      } else {
        const mensajeError = data?.detail || data?.error || "Hubo un error al enviar el mensaje.";
        setFormStatus(`Error: ${mensajeError}`, "error");
        showToast(`Error: ${mensajeError}`, "error");
      }
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
      setFormStatus("No se pudo enviar el mensaje. Verifica que el backend este corriendo en puerto 3000.", "error");
      showToast("Sin conexion con API. Levanta Backend en localhost:3000.", "error");
    } finally {
      setSubmitState(false);
    }
  });
}

// ===============================
// CARRITO ÚNICO EN CATÁLOGO
// ===============================
// El frontend estático no mantiene carrito propio.
// Las acciones comerciales deben navegar al catálogo SvelteKit.

// ===============================
// BANNER ROTATIVO
// ===============================
let currentSlide = 0;
const slides = document.querySelectorAll(".banner-slider .slide");
const dots = document.querySelectorAll(".banner-dots .dot");

function showSlide(index) {
  if (slides.length === 0) return;

  const safeIndex = (index + slides.length) % slides.length;
  slides[currentSlide].classList.remove("active");
  slides[safeIndex].classList.add("active");

  if (dots.length) {
    dots.forEach(dot => dot.classList.remove("active"));
    dots[safeIndex]?.classList.add("active");
  }

  currentSlide = safeIndex;
}

function changeSlide() {
  showSlide(currentSlide + 1);
}

if (slides.length) {
  if (dots.length) {
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => showSlide(index));
    });
  }

  showSlide(0);
  setInterval(changeSlide, 5000);
}
