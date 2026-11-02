import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env";
import { redis } from "./config/redis";
import { tenantMiddleware } from "./middlewares/tenant.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import authRouter from "./routes/auth.routes";

export const createApp = (): Application => {
  const app = express();

  // Security & HTTP utility middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: [env.CLIENT_URL, "http://localhost:3000"],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  // System Health Check (Exempt from tenant middleware)
  app.get("/health", async (_req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    let redisStatus = "disconnected";

    try {
      const ping = await redis.ping();
      if (ping === "PONG") redisStatus = "connected";
    } catch {
      redisStatus = "disconnected";
    }

    const isHealthy = mongoStatus === "connected" && redisStatus === "connected";

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      uptime: process.uptime(),
    });
  });

  // Multitenancy validation test endpoint
  app.get("/api/v1/tenant/current", tenantMiddleware, (req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Tenant verified successfully",
      tenant: req.tenant,
    });
  });

  // Authentication & RBAC routes
  app.use("/api/v1/auth", authRouter);

  // Catch-all 404 & Centralized Error Handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
