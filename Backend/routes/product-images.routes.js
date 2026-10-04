import { Router } from "express";
import { getPublicProductImage } from "../controllers/product-images.controller.js";

const router = Router();
router.get("/:id", getPublicProductImage);
export default router;