import { Request, Response, NextFunction } from "express";
import { Tenant } from "../models/tenant.model";
import { redis } from "../config/redis";

const TENANT_CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Extracts tenant slug from:
 * 1. X-Tenant-ID header (API calls / testing)
 * 2. Hostname subdomain (e.g., apollo.medpilot.com -> "apollo")
 */
export const resolveTenantSlug = (req: Request): string | null => {
  // Check header first
  const headerTenant = req.header("X-Tenant-ID") || req.header("x-tenant-id");
  if (headerTenant && typeof headerTenant === "string") {
    return headerTenant.trim().toLowerCase();
  }

  // Check hostname subdomain
  const hostname = req.hostname || req.headers.host || "";
  const parts = hostname.split(".");

  // e.g. apollo.medpilot.com (3 parts) -> "apollo"
  // If localhost (e.g. apollo.localhost:5000), parts = ["apollo", "localhost"]
  if (parts.length >= 2) {
    const subdomain = parts[0].toLowerCase();
    // Ignore generic subdomains
    if (subdomain !== "www" && subdomain !== "api" && subdomain !== "localhost") {
      return subdomain;
    }
  }

  return null;
};

/**
 * Tenant resolution middleware:
 * Looks up tenant from Redis cache, falls back to MongoDB, attaches to req.tenant
 */
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slug = resolveTenantSlug(req);

    if (!slug) {
      res.status(400).json({
        success: false,
        error: "Tenant identifier missing. Provide a valid subdomain or X-Tenant-ID header.",
      });
      return;
    }

    const cacheKey = `tenant:slug:${slug}`;

    // 1. Try Redis Cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const tenant = JSON.parse(cached);
        if (tenant.status !== "active") {
          res.status(403).json({
            success: false,
            error: "This hospital workspace is currently inactive or suspended.",
          });
          return;
        }
        req.tenant = tenant;
        return next();
      }
    } catch (cacheErr) {
      // Redis failover: Log and continue with DB
      console.warn("Redis tenant cache read failed, falling back to DB:", cacheErr);
    }

    // 2. Query MongoDB
    const tenant = await Tenant.findOne({ slug });

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: `Hospital tenant '${slug}' not found.`,
      });
      return;
    }

    if (tenant.status !== "active") {
      res.status(403).json({
        success: false,
        error: "This hospital workspace is currently inactive or suspended.",
      });
      return;
    }

    // 3. Populate Redis Cache
    try {
      await redis.setex(cacheKey, TENANT_CACHE_TTL, JSON.stringify(tenant.toJSON()));
    } catch (cacheSetErr) {
      console.warn("Failed to set tenant in Redis cache:", cacheSetErr);
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
};
