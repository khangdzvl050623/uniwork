-- CreateEnum
CREATE TYPE "ChatKind" AS ENUM ('AI_STUDENT', 'AI_EMPLOYER');

-- CreateEnum
CREATE TYPE "ChatSessionState" AS ENUM ('AI_ACTIVE', 'WAITING_EMPLOYER', 'HUMAN_ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('STUDENT', 'EMPLOYER', 'AI', 'SYSTEM');

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "kind" "ChatKind" NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "studentProfileId" TEXT,
    "jobId" TEXT,
    "handoffEmployerProfileId" TEXT,
    "state" "ChatSessionState" NOT NULL DEFAULT 'AI_ACTIVE',
    "messageSeq" INTEGER NOT NULL DEFAULT 0,
    "employerVisibleFromSeq" INTEGER,
    "activeAiRunId" TEXT,
    "handoffRequestedAt" TIMESTAMP(3),
    "handoffAcceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "previousSessionId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "senderType" "ChatSenderType" NOT NULL,
    "senderUserId" TEXT,
    "clientMessageId" TEXT,
    "body" TEXT NOT NULL,
    "visibleToEmployer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_previousSessionId_key" ON "chat_sessions"("previousSessionId");

-- CreateIndex
CREATE INDEX "chat_sessions_ownerUserId_kind_lastMessageAt_idx" ON "chat_sessions"("ownerUserId", "kind", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_sessions_handoffEmployerProfileId_state_lastMessageAt_idx" ON "chat_sessions"("handoffEmployerProfileId", "state", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_ownerUserId_clientSessionId_key" ON "chat_sessions"("ownerUserId", "clientSessionId");

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_seq_idx" ON "chat_messages"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_sessionId_seq_key" ON "chat_messages"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_sessionId_clientMessageId_key" ON "chat_messages"("sessionId", "clientMessageId");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_handoffEmployerProfileId_fkey" FOREIGN KEY ("handoffEmployerProfileId") REFERENCES "employer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- VIẾT TAY — bốn CHECK constraint. Prisma không khai được CHECK.
-- ---------------------------------------------------------------------------
--
-- Bốn ràng buộc này giữ cho hai vai "CHỦ PHIÊN" và "NTD NHẬN HANDOFF" không lẫn
-- vào nhau. Thiếu chúng, một dòng code sai sẽ tạo ra hàng vô nghĩa mà không gì
-- kêu lên — và loại vô nghĩa ở đây là "NTD B đọc được hội thoại riêng của người
-- khác", không phải một con số lệch.
--
-- Cùng lớp với bốn CHECK của Sprint 2, xem test-db/rang-buoc.test.ts.

-- 1. AI_STUDENT bắt buộc có hồ sơ sinh viên; AI_EMPLOYER bắt buộc KHÔNG có.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_kind_student_profile" CHECK (
  (kind = 'AI_STUDENT'  AND "studentProfileId" IS NOT NULL) OR
  (kind = 'AI_EMPLOYER' AND "studentProfileId" IS NULL)
);

-- 2. Phiên trợ lý của NTD KHÔNG BAO GIỜ có người nhận handoff.
--    Không có dòng này thì một bug có thể biến phiên riêng của NTD A thành thứ
--    mà NTD B đọc được.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_employer_khong_handoff" CHECK (
  kind = 'AI_STUDENT' OR "handoffEmployerProfileId" IS NULL
);

-- 3. Phiên của NTD chỉ ở AI_ACTIVE hoặc CLOSED — không có WAITING/HUMAN.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_employer_trang_thai" CHECK (
  kind = 'AI_STUDENT' OR state IN ('AI_ACTIVE', 'CLOSED')
);

-- 4. Đã rời AI_ACTIVE thì phải có ĐỦ người nhận, tin, và mốc đọc.
--    Thiếu một trong ba là hội thoại ở trạng thái không diễn giải được.
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_handoff_du_thong_tin" CHECK (
  state = 'AI_ACTIVE' OR state = 'CLOSED' OR (
    "handoffEmployerProfileId" IS NOT NULL AND
    "jobId"                    IS NOT NULL AND
    "employerVisibleFromSeq"   IS NOT NULL
  )
);
