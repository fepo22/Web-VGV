// ===============================
// VGV SPA - Script Frontend Optimizado
// ===============================

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

  const itemWidth = items[0].offsetWidth + 20;
  const originalWidth = items.length * itemWidth;

  const move = dir => {
    track.scrollBy({ left: dir * itemWidth, behavior: "smooth" });
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
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalPreview && window.location.port && window.location.port !== "4000") {
    return "http://localhost:4000/api/contacto";
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
      setFormStatus("No se pudo enviar el mensaje. Verifica que el backend este corriendo en puerto 4000.", "error");
      showToast("Sin conexion con API. Levanta Backend en localhost:4000.", "error");
    } finally {
      setSubmitState(false);
    }
  });
}

// ===============================
// COTIZADOR — LÓGICA PRINCIPAL
// ===============================
const CART_KEY = "vgv_cart";
const CART_RESET_MINUTES = 10;

function updateCartCounter() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    const counter = document.getElementById("cart-counter");
    if (counter) counter.textContent = cart.length;
  } catch (error) {
    console.warn("No fue posible leer el carrito:", error);
  }
}

function checkCartExpiration() {
  try {
    const lastTime = localStorage.getItem(`${CART_KEY}_time`);
    if (!lastTime) {
      localStorage.setItem(`${CART_KEY}_time`, Date.now());
      return;
    }

    const diffMinutes = (Date.now() - lastTime) / 1000 / 60;
    if (diffMinutes >= CART_RESET_MINUTES) {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(`${CART_KEY}_time`);
      updateCartCounter();
    }
  } catch (error) {
    console.warn("No fue posible validar la expiración del carrito:", error);
  }
}

checkCartExpiration();
updateCartCounter();

// ===============================
// BANNER ROTATIVO
// ===============================
let currentSlide = 0;
const slides = document.querySelectorAll(".banner-slider .slide");

function changeSlide() {
  if (slides.length === 0) return;
  slides[currentSlide].classList.remove("active");
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].classList.add("active");
}

if (slides.length) {
  setInterval(changeSlide, 5000);
}
