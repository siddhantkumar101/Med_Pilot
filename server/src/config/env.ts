import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env file explicitly from server root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.string().default("6379").transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional().default(""),
  COOKIE_SECRET: z.string().min(10, "COOKIE_SECRET should be at least 10 chars"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Environment Variables Validation Failed:");
    const errors = result.error.issues.map((issue) => ({
      Variable: issue.path.join("."),
      Error: issue.message,
    }));
    console.table(errors);
    console.error("💡 Please fix these variables in your .env file before restarting.\n");
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
