// src/utils/redisClient.js
import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redis = new Redis(url, {
  // optional: enable TLS when using rediss://
  // tls: { rejectUnauthorized: false }
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

export default redis;
