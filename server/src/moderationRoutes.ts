import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import { requireAuth, AuthPayload } from "./auth";

export const moderationRouter = Router();

const REPORT_BAN_THRESHOLD = 5;

const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

moderationRouter.post("/report", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as Request & { auth: AuthPayload }).auth;
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { reportedUserId, reason } = parsed.data;

  if (reportedUserId === auth.userId) {
    return res.status(400).json({ error: "Cannot report yourself" });
  }

  await prisma.report.create({
    data: { reporterId: auth.userId, reportedId: reportedUserId, reason },
  });

  const reportCount = await prisma.report.count({ where: { reportedId: reportedUserId } });
  if (reportCount >= REPORT_BAN_THRESHOLD) {
    await prisma.user.update({ where: { id: reportedUserId }, data: { isBanned: true } });
  }

  res.json({ ok: true, reportCount });
});

const blockSchema = z.object({
  blockedUserId: z.string().uuid(),
});

moderationRouter.post("/block", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as Request & { auth: AuthPayload }).auth;
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { blockedUserId } = parsed.data;

  if (blockedUserId === auth.userId) {
    return res.status(400).json({ error: "Cannot block yourself" });
  }

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: auth.userId, blockedId: blockedUserId } },
    create: { blockerId: auth.userId, blockedId: blockedUserId },
    update: {},
  });

  res.json({ ok: true });
});

moderationRouter.get("/blocked", requireAuth, async (req: Request, res: Response) => {
  const auth = (req as Request & { auth: AuthPayload }).auth;
  const blocks = await prisma.block.findMany({ where: { blockerId: auth.userId } });
  res.json({ blockedUserIds: blocks.map((b) => b.blockedId) });
});
