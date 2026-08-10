import { Router } from "express";
import { sendContact } from "../controllers/contact.controller.js";
import { contactLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";

const router = Router();

router.post("/", contactLimiter, sanitizeMiddleware, sendContact);

export default router;
