import { Router } from "express";
import { getQuotations, sendQuotation, updateQuotationStatus } from "../controllers/cotizar.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { adminLimiter, contactLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";

const router = Router();

router.post("/", contactLimiter, sanitizeMiddleware, sendQuotation);
router.get("/", authMiddleware, getQuotations);
router.patch("/:id/estado", authMiddleware, sanitizeMiddleware, adminLimiter, updateQuotationStatus);

export default router;

