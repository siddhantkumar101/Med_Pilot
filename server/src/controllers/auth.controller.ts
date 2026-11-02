import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { UserRole } from "../models/user.model";
import { User } from "../models/user.model";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(UserRole).optional().default(UserRole.PATIENT),
  phone: z.string().optional(),
  metadata: z
    .object({
      specialization: z.string().optional(),
      licenseNumber: z.string().optional(),
      department: z.string().optional(),
      dateOfBirth: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
      bloodGroup: z.string().optional(),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Validation error",
          issues: parsed.error.issues,
        });
        return;
      }

      // Automatically scope registration to active tenant
      const tenantId = req.tenant?._id?.toString();

      // Only SUPERADMIN can register without a tenant
      if (!tenantId && parsed.data.role !== UserRole.SUPERADMIN) {
        res.status(400).json({
          success: false,
          error: "Hospital context missing. Please register via a valid hospital subdomain or header.",
        });
        return;
      }

      const result = await AuthService.register({
        ...parsed.data,
        tenantId,
      });

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Validation error",
          issues: parsed.error.issues,
        });
        return;
      }

      const tenantId = req.tenant?._id?.toString();
      const result = await AuthService.login(parsed.data.email, parsed.data.password, tenantId);

      res.json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Refresh token missing or invalid",
        });
        return;
      }

      const tokens = await AuthService.refresh(parsed.data.refreshToken);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: tokens,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await AuthService.logout(req.user.userId);
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const user = await User.findById(req.user.userId).populate("tenantId", "name slug");
      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
}
