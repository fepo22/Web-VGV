import { Router } from "express";
import {
	createProductController,
	deleteProductController,
	getProductById,
	getProducts,
	updateProductController
} from "../controllers/products.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { adminLimiter } from "../middlewares/rateLimit.js";
import { sanitizeMiddleware } from "../middlewares/sanitize.js";

const router = Router();

router.use(authMiddleware, sanitizeMiddleware, adminLimiter);

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", createProductController);
router.put("/:id", updateProductController);
router.delete("/:id", deleteProductController);

export default router;
