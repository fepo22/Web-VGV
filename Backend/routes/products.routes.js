import { Router } from "express";
import {
	createProductController,
	bulkImportProductsController,
	deleteProductController,
	getAdminProductById,
	getAdminProducts,
	getProductImportController,
	updateProductController
} from "../controllers/products.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { adminLimiter } from "../middlewares/rateLimit.js";
import { receiveProductImage, uploadProductImage } from "../controllers/product-images.controller.js";

const router = Router();

router.use(adminLimiter, authMiddleware);

router.post("/images", receiveProductImage, uploadProductImage);
router.get("/", getAdminProducts);
router.get("/bulk/:batchId", getProductImportController);
router.get("/:id", getAdminProductById);
router.post("/bulk", bulkImportProductsController);
router.post("/", createProductController);
router.put("/:id", updateProductController);
router.delete("/:id", deleteProductController);

export default router;
