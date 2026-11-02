import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy(times) {
    if (times > 5) {
      console.warn("⚠️ Redis retry limit reached. Continuing without cache...");
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect();
  } catch (error) {
    console.error("❌ Redis initial connection failed:", (error as Error).message);
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};
