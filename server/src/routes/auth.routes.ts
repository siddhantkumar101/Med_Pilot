import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";

const router = Router();

// Public auth routes (require tenant context for multi-tenancy)
router.post("/register", tenantMiddleware, AuthController.register);
router.post("/login", tenantMiddleware, AuthController.login);
router.post("/refresh-token", AuthController.refresh);

// Protected routes (require valid JWT access token)
router.post("/logout", authenticate, AuthController.logout);
router.get("/me", authenticate, AuthController.getMe);

export default router;
