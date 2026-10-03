import { HttpException, HttpStatus } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "./prisma.service";

export async function consumeRateLimit(db: PrismaService, key: string, limit: number, windowMs: number) {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const resetAt = new Date(Date.now() + windowMs);
  const result = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginThrottle" ("id", "keyHash", "attempts", "resetAt", "updatedAt")
    VALUES (${randomBytes(16).toString("hex")}, ${keyHash}, 1, ${resetAt}, CURRENT_TIMESTAMP)
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "LoginThrottle"."attempts" + 1 END,
      "resetAt" = CASE WHEN "LoginThrottle"."resetAt" <= CURRENT_TIMESTAMP THEN ${resetAt} ELSE "LoginThrottle"."resetAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "attempts"
  `;
  if (result[0]?.attempts > limit) throw new HttpException("Too many requests. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
  if (randomBytes(1)[0] === 0) await db.loginThrottle.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86400_000) } } });
}
