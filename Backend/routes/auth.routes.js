import { Router } from "express";

import { loginAuth } from "../controllers/auth.controller.js";
import { authLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";

const router = Router();

router.post("/login", authLimiter, sanitizeMiddleware, loginAuth);

export default router;