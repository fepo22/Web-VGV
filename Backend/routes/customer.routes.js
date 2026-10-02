import { Router } from "express";
import {
  forgotPassword, getCustomerProfile, googleCustomer, linkGoogleCustomer,
  loginCustomer, logoutCustomer, registerCustomer, requireCustomer,
  resendVerification, resetPassword, saveCustomerProfile, verifyCustomer
} from "../controllers/customer.controller.js";
import { getCustomerQuotations } from "../controllers/cotizar.controller.js";
import { authLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.post("/registrar", authLimiter, registerCustomer);
router.post("/verificar", authLimiter, verifyCustomer);
router.post("/reenviar", authLimiter, resendVerification);
router.post("/ingresar", authLimiter, loginCustomer);
router.post("/google", authLimiter, googleCustomer);
router.post("/recuperar", authLimiter, forgotPassword);
router.post("/restablecer", authLimiter, resetPassword);
router.post("/salir", logoutCustomer);
router.get("/mi-perfil", requireCustomer, getCustomerProfile);
router.put("/mi-perfil", requireCustomer, saveCustomerProfile);
router.post("/vincular-google", requireCustomer, linkGoogleCustomer);
router.get("/cotizaciones", requireCustomer, getCustomerQuotations);

export default router;