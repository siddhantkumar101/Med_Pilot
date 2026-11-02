import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB, closeDB } from "./config/db";
import { connectRedis, redis } from "./config/redis";

const startServer = async () => {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Connect Redis
  await connectRedis();

  // 3. Initialize Express Application
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    console.log(`🚀 Med_Pilot Server running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`);
    console.log(`📡 Health Check: http://localhost:${env.PORT}/health`);
  });

  // Graceful shutdown handling
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log("🔌 HTTP Server closed.");
      await closeDB();
      redis.disconnect();
      console.log("🔒 Redis disconnected.");
      process.exit(0);
    });

    // Force exit after 10 seconds if hanging
    setTimeout(() => {
      console.error("⚠️ Forcefully exiting after shutdown timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
};

startServer().catch((err) => {
  console.error("❌ Fatal server startup error:", err);
  process.exit(1);
});
