import Redis from "ioredis";
import { env } from "./env";

// Separate connections: one for general commands, two reserved for the
// Socket.io adapter (pub/sub requires dedicated connections).
export const redis = new Redis(env.redisUrl);
export const pubClient = new Redis(env.redisUrl);
export const subClient = pubClient.duplicate();

// An unhandled "error" event on an ioredis client crashes the whole Node
// process by default. Attach handlers so transient network blips (or a
// misconfigured REDIS_URL) log loudly instead of taking the server down.
for (const client of [redis, pubClient, subClient]) {
  client.on("error", (err) => {
    console.error("Redis client error:", err.message);
  });
}

export const QUEUE_KEY = "openup:waiting_queue";
export const SOCKET_MAP_KEY = "openup:user_sockets"; // userId -> socketId hash
