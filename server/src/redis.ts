import Redis from "ioredis";
import { env } from "./env";

// Separate connections: one for general commands, two reserved for the
// Socket.io adapter (pub/sub requires dedicated connections).
export const redis = new Redis(env.redisUrl);
export const pubClient = new Redis(env.redisUrl);
export const subClient = pubClient.duplicate();

export const QUEUE_KEY = "openup:waiting_queue";
export const SOCKET_MAP_KEY = "openup:user_sockets"; // userId -> socketId hash
