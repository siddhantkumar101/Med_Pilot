import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.util";
import { UserRole } from "../models/user.model";

/**
 * Authentication Middleware:
 * Verifies JWT Access Token and checks tenant consistency
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Access denied. No authentication token provided.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Cross-tenant verification: Ensure user belongs to the active tenant
    // SUPERADMIN is exempted (can inspect any hospital)
    if (decoded.role !== UserRole.SUPERADMIN) {
      if (req.tenant && decoded.tenantId && req.tenant._id.toString() !== decoded.tenantId) {
        res.status(403).json({
          success: false,
          error: "Cross-tenant access forbidden. You cannot access another hospital's portal.",
        });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "Invalid or expired access token.",
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Guard:
 * Restricts route access to specific roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized. Authentication required before role check.",
      });
      return;
    }

    // SUPERADMIN has universal access
    if (req.user.role === UserRole.SUPERADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden. Role '${req.user.role}' does not have permission to access this resource.`,
      });
      return;
    }

    next();
  };
};
