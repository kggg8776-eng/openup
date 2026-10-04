import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { env } from "./env";

export interface AuthPayload {
  userId: string;
  displayName: string;
  isGuest: boolean;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    (req as Request & { auth?: AuthPayload }).auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(30),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const guestSchema = z.object({
  displayName: z.string().min(2).max(30).optional(),
});

authRouter.post("/guest", async (req: Request, res: Response) => {
  const parsed = guestSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const displayName = parsed.data.displayName ?? `Guest${Math.floor(Math.random() * 100000)}`;
  const user = await prisma.user.create({
    data: { displayName, isGuest: true },
  });

  const token = signToken({ userId: user.id, displayName: user.displayName, isGuest: true });
  res.json({ token, user: { id: user.id, displayName: user.displayName, isGuest: true } });
});

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, isGuest: false },
  });

  const token = signToken({ userId: user.id, displayName: user.displayName, isGuest: false });
  res.json({ token, user: { id: user.id, displayName: user.displayName, isGuest: false } });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });
  if (user.isBanned) return res.status(403).json({ error: "Account banned" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, displayName: user.displayName, isGuest: false });
  res.json({ token, user: { id: user.id, displayName: user.displayName, isGuest: false } });
});
