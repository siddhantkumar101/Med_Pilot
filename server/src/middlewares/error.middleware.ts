import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("🔥 Unhandled Server Error:", err.stack || err.message);

  res.status(500).json({
    success: false,
    error: env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
    ...(env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
