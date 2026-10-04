import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { verifyToken, AuthPayload } from "./auth";
import { prisma } from "./prisma";
import { redis, QUEUE_KEY } from "./redis";

// NOTE on horizontal scaling: matching below only pairs sockets that are
// connected to the SAME server process (checked via io.sockets.sockets.get).
// Signaling/chat use Socket.io rooms, which already broadcast across
// instances via the Redis adapter attached in index.ts. To make matchmaking
// itself cross-instance, add a Redis pub/sub "match_events" relay that lets
// any instance hand a matched candidate off to the instance that owns its
// socket. Not needed until you run more than one server process.

const roomBySocket = new Map<string, string>(); // socketId -> roomId
const partnerBySocket = new Map<string, string>(); // socketId -> partner socketId

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized: missing token"));
    try {
      socket.data.auth = verifyToken(token);
      next();
    } catch {
      next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const auth = socket.data.auth as AuthPayload;
    console.log(`connected: ${auth.displayName} (${socket.id})`);

    socket.on("find_match", () => {
      void handleFindMatch(io, socket);
    });

    socket.on("signal", (data: unknown) => {
      const roomId = roomBySocket.get(socket.id);
      if (!roomId) return;
      socket.to(roomId).emit("signal", data);
    });

    socket.on("chat_message", (message: string) => {
      const roomId = roomBySocket.get(socket.id);
      if (!roomId || typeof message !== "string") return;
      socket.to(roomId).emit("chat_message", {
        from: auth.displayName,
        message: message.slice(0, 1000),
      });
    });

    socket.on("skip", () => {
      void (async () => {
        await leaveCurrentRoom(io, socket, "partner_skipped");
        await handleFindMatch(io, socket);
      })();
    });

    socket.on("disconnect", () => {
      void (async () => {
        console.log(`disconnected: ${auth.displayName} (${socket.id})`);
        await removeFromQueue(socket.id);
        await leaveCurrentRoom(io, socket, "partner_left");
      })();
    });
  });
}

interface QueueEntry {
  userId: string;
  socketId: string;
  displayName: string;
}

async function handleFindMatch(io: Server, socket: Socket) {
  const auth = socket.data.auth as AuthPayload;
  if (roomBySocket.has(socket.id)) return;

  const blockedIds = await getBlockedUserIdSet(auth.userId);

  let candidate: QueueEntry | null = null;
  // Bounded scan to skip over stale/disconnected/blocked entries without looping forever.
  for (let attempts = 0; attempts < 20; attempts++) {
    const raw = await redis.lpop(QUEUE_KEY);
    if (!raw) break;

    const parsed = JSON.parse(raw) as QueueEntry;
    if (parsed.userId === auth.userId) continue;
    if (!io.sockets.sockets.get(parsed.socketId)) continue;

    const theyBlockedMe = (await getBlockedUserIdSet(parsed.userId)).has(auth.userId);
    if (blockedIds.has(parsed.userId) || theyBlockedMe) continue;

    candidate = parsed;
    break;
  }

  if (!candidate) {
    await redis.rpush(
      QUEUE_KEY,
      JSON.stringify({ userId: auth.userId, socketId: socket.id, displayName: auth.displayName })
    );
    socket.emit("waiting");
    return;
  }

  const candidateSocket = io.sockets.sockets.get(candidate.socketId);
  if (!candidateSocket) {
    socket.emit("waiting");
    return;
  }

  const roomId = randomUUID();
  socket.join(roomId);
  candidateSocket.join(roomId);
  roomBySocket.set(socket.id, roomId);
  roomBySocket.set(candidate.socketId, roomId);
  partnerBySocket.set(socket.id, candidate.socketId);
  partnerBySocket.set(candidate.socketId, socket.id);

  socket.emit("matched", {
    roomId,
    partner: { userId: candidate.userId, displayName: candidate.displayName },
    isInitiator: true,
  });
  candidateSocket.emit("matched", {
    roomId,
    partner: { userId: auth.userId, displayName: auth.displayName },
    isInitiator: false,
  });
}

async function leaveCurrentRoom(io: Server, socket: Socket, notifyEvent: string) {
  const roomId = roomBySocket.get(socket.id);
  const partnerSocketId = partnerBySocket.get(socket.id);

  if (roomId) {
    socket.leave(roomId);
    roomBySocket.delete(socket.id);
  }
  if (partnerSocketId) {
    partnerBySocket.delete(socket.id);
    partnerBySocket.delete(partnerSocketId);
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);
    if (partnerSocket) {
      roomBySocket.delete(partnerSocketId);
      if (roomId) partnerSocket.leave(roomId);
      partnerSocket.emit(notifyEvent);
    }
  }
}

async function removeFromQueue(socketId: string) {
  const items = await redis.lrange(QUEUE_KEY, 0, -1);
  const stillWaiting = items.filter((raw) => {
    try {
      return (JSON.parse(raw) as QueueEntry).socketId !== socketId;
    } catch {
      return false;
    }
  });
  if (stillWaiting.length !== items.length) {
    await redis.del(QUEUE_KEY);
    if (stillWaiting.length) await redis.rpush(QUEUE_KEY, ...stillWaiting);
  }
}

async function getBlockedUserIdSet(userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({ where: { blockerId: userId } });
  return new Set(blocks.map((b) => b.blockedId));
}
