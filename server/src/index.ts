import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./env";
import { pubClient, subClient } from "./redis";
import { authRouter } from "./auth";
import { moderationRouter } from "./moderationRoutes";
import { registerSocketHandlers } from "./socket";

const app = express();
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/ice-servers", (_req, res) => {
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: env.stunUrls },
  ];
  if (env.turnUrl) {
    iceServers.push({
      urls: env.turnUrl,
      username: env.turnUsername,
      credential: env.turnCredential,
    });
  }
  res.json({ iceServers });
});

app.use("/api/auth", authRouter);
app.use("/api", moderationRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.clientOrigins },
});

// ioredis clients auto-connect on creation; just wire up the adapter.
io.adapter(createAdapter(pubClient, subClient));
registerSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
