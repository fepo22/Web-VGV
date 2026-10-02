import { Router } from "express";
import { sendContact } from "../controllers/contact.controller.js";
import { contactLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.post("/", contactLimiter, sendContact);

export default router;
