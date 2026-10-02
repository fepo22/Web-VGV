import { Router } from "express";
import {
	createProductController,
	bulkImportProductsController,
	deleteProductController,
	getAdminProductById,
	getAdminProducts,
	updateProductController
} from "../controllers/products.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { adminLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.use(adminLimiter, authMiddleware);

router.get("/", getAdminProducts);
router.get("/:id", getAdminProductById);
router.post("/bulk", bulkImportProductsController);
router.post("/", createProductController);
router.put("/:id", updateProductController);
router.delete("/:id", deleteProductController);

export default router;
