-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('CHAT', 'CV_SCAN');

-- CreateEnum
CREATE TYPE "AiTurnState" AS ENUM ('RESERVED', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "ai_usage_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "turnsReserved" INTEGER NOT NULL DEFAULT 0,
    "turnsUsed" INTEGER NOT NULL DEFAULT 0,
    "turnsRefunded" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_turns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "state" "AiTurnState" NOT NULL DEFAULT 'RESERVED',
    "runnerId" TEXT NOT NULL,
    "quotaDay" DATE NOT NULL,
    "sessionId" TEXT,
    "extractionId" TEXT,
    "category" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "toolRounds" INTEGER NOT NULL DEFAULT 0,
    "toolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "timeToFirstTokenMs" INTEGER,
    "errorCode" TEXT,
    "handoffProposed" BOOLEAN NOT NULL DEFAULT false,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "ai_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_days_userId_day_feature_key" ON "ai_usage_days"("userId", "day", "feature");

-- CreateIndex
CREATE INDEX "ai_turns_userId_reservedAt_idx" ON "ai_turns"("userId", "reservedAt");

-- CreateIndex
CREATE INDEX "ai_turns_feature_reservedAt_idx" ON "ai_turns"("feature", "reservedAt");

-- AddForeignKey
ALTER TABLE "ai_usage_days" ADD CONSTRAINT "ai_usage_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- VIẾT TAY — Prisma không sinh được phần này
-- ---------------------------------------------------------------------------
--
-- Luật: MỘT tài khoản chỉ được có MỘT lượt AI đang chạy.
--
-- Đây là chỉ mục UNIQUE MỘT PHẦN (partial unique index): nó chỉ ràng buộc các
-- hàng có state = 'RESERVED'. Hàng đã SUCCEEDED/FAILED/REFUNDED thì bao nhiêu
-- cũng được.
--
-- Vì sao không kiểm bằng câu `if` trong code: giữa lúc đọc "user này có lượt nào
-- đang chạy không" và lúc ghi hàng mới có một khe hở. Hai tab bấm cùng lúc thì
-- cả hai đều đọc thấy "không có", cả hai đều ghi. Chỉ mục thì Postgres cưỡng chế,
-- không có khe hở nào.
--
-- Lượt thứ hai sẽ nhận lỗi Prisma P2002, và tầng service dịch thành 409 AI_BUSY.
--
-- Prisma Client KHÔNG biết về chỉ mục này (schema.prisma không khai được), nên
-- `prisma migrate dev` sau này sẽ không xoá nó — nhưng `prisma db push` thì có.
-- Đừng dùng db push trên dự án này.
CREATE UNIQUE INDEX "ai_turns_mot_luot_dang_chay"
  ON "ai_turns" ("userId")
  WHERE state = 'RESERVED';
