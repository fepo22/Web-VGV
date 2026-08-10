import { Router } from "express";
import { sendContact } from "../controllers/contact.controller.js";
import { contactLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";
import authMiddleware from "../middlewares/auth.js";

const router = Router();

router.post("/", contactLimiter, sanitizeMiddleware, authMiddleware, sendContact);

export default router;

