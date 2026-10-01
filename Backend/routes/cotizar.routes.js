import { Router } from "express";
import { getQuotations, sendQuotation } from "../controllers/cotizar.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { contactLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";

const router = Router();

router.post("/", contactLimiter, sanitizeMiddleware, sendQuotation);
router.get("/", authMiddleware, getQuotations);

export default router;

