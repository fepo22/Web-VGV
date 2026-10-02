import { Router } from "express";

import { loginAuth } from "../controllers/auth.controller.js";
import { authLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.post("/login", authLimiter, loginAuth);

export default router;