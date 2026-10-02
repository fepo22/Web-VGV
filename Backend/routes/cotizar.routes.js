import { Router } from "express";
import { getQuotations, sendQuotation, updateQuotationStatus } from "../controllers/cotizar.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { adminLimiter, contactLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.post("/", contactLimiter, sendQuotation);
router.get("/", authMiddleware, getQuotations);
router.patch("/:id/estado", authMiddleware, adminLimiter, updateQuotationStatus);

export default router;

