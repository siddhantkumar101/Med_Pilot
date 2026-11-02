import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    // Don't crash immediately in dev so app can still test non-DB routes if Mongo is starting
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Attempting reconnect...");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error event:", err);
});

export const closeDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log("🔒 MongoDB connection closed");
};
