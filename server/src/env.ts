import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated list so local dev + the deployed frontend can both work.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim()),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  stunUrls: (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302").split(","),
  turnUrl: process.env.TURN_URL ?? "",
  turnUsername: process.env.TURN_USERNAME ?? "",
  turnCredential: process.env.TURN_CREDENTIAL ?? "",
};
