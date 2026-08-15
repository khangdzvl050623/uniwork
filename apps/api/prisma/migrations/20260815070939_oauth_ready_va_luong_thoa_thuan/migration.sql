-- Chuẩn bị cho đăng nhập Google, thêm lương thoả thuận, và siết ràng buộc
-- thời gian của tin tuyển dụng xuống tận database.
--
-- File này ĐƯỢC SỬA TAY sau khi `prisma migrate dev --create-only` sinh ra bản
-- nháp. Hai chỗ khác bản nháp:
--
-- 1. Prisma đề nghị DROP bảng `auth_tokens` rồi CREATE `one_time_tokens`. Bảng
--    đang rỗng nên không mất gì, nhưng huỷ bảng trong khi chỉ cần đổi tên là
--    thói quen sẽ trả giá ở lần sau, khi bảng có dữ liệu thật. Đổi thành RENAME.
--
-- 2. Thêm bốn CHECK constraint ở cuối. Prisma không diễn đạt được chúng trong
--    schema, nhưng đó chính là chỗ luật nghiệp vụ cần được canh: Zod ở tầng
--    service có thể bị đi vòng bởi script sửa dữ liệu, câu SQL vá tay lúc gấp,
--    hay một endpoint viết vội ở sprint sau. CHECK thì không đường nào lách.

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- ---------------------------------------------------------------------------
-- Đổi tên auth_tokens -> one_time_tokens (không huỷ bảng)
--
-- Tên cũ mơ hồ tới mức người đọc tưởng đây là chỗ lưu access token — trong khi
-- access token là JWT, cố tình không lưu ở đâu cả.
-- ---------------------------------------------------------------------------

ALTER TYPE "AuthTokenType" RENAME TO "OneTimeTokenType";

ALTER TABLE "auth_tokens" RENAME TO "one_time_tokens";

ALTER TABLE "one_time_tokens" RENAME CONSTRAINT "auth_tokens_pkey" TO "one_time_tokens_pkey";
ALTER TABLE "one_time_tokens" RENAME CONSTRAINT "auth_tokens_userId_fkey" TO "one_time_tokens_userId_fkey";

ALTER INDEX "auth_tokens_tokenHash_key" RENAME TO "one_time_tokens_tokenHash_key";
ALTER INDEX "auth_tokens_userId_type_idx" RENAME TO "one_time_tokens_userId_type_idx";

-- ---------------------------------------------------------------------------
-- Tài khoản không mật khẩu + danh tính Google
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_accounts_userId_idx" ON "user_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_provider_providerAccountId_key" ON "user_accounts"("provider", "providerAccountId");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Lương thoả thuận
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "salaryNegotiable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "salaryMin" DROP NOT NULL,
ALTER COLUMN "salaryMax" DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- CHECK constraint — luật nghiệp vụ canh ở tầng database
-- ---------------------------------------------------------------------------

-- Ba loại thời gian dùng ba nhóm cột khác nhau, và KHÔNG được lẫn.
--
-- Nguyên tắc đặt luật: chỉ cấm cái MÂU THUẪN, không cấm cái chưa khai. Nên
-- RECURRING được phép bỏ trống cả `startDate` lẫn `commitmentMonths` (tuyển là
-- đi làm ngay, không đòi cam kết), nhưng tuyệt đối không được mang `endDate` —
-- việc định kỳ theo định nghĩa là không có điểm kết thúc xác định.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_schedule_fields_check" CHECK (
  CASE "scheduleType"
    WHEN 'RECURRING' THEN
      "endDate" IS NULL AND "workDate" IS NULL
    WHEN 'SEASONAL' THEN
      "startDate" IS NOT NULL
      AND "endDate" IS NOT NULL
      AND "endDate" >= "startDate"
      AND "commitmentMonths" IS NULL
      AND "workDate" IS NULL
    WHEN 'ONE_TIME' THEN
      "workDate" IS NOT NULL
      AND "startDate" IS NULL
      AND "endDate" IS NULL
      AND "commitmentMonths" IS NULL
      AND "minShiftsPerWeek" IS NULL
  END
);

-- Lương: hoặc thoả thuận và không có số nào, hoặc có đủ cả hai số và min <= max.
--
-- Cấm luôn trạng thái nửa vời "thoả thuận nhưng vẫn ghi 25000" — đó chính là
-- kiểu dữ liệu làm bộ lọc lương trả về kết quả không ai giải thích được.
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_check" CHECK (
  ("salaryNegotiable" = true AND "salaryMin" IS NULL AND "salaryMax" IS NULL)
  OR
  ("salaryNegotiable" = false
    AND "salaryMin" IS NOT NULL
    AND "salaryMax" IS NOT NULL
    AND "salaryMin" >= 0
    AND "salaryMax" >= "salaryMin")
);

-- Thứ trong tuần theo quy ước Date.prototype.getDay(): 0 = Chủ nhật ... 6 = Thứ 7.
--
-- Một giá trị 7 lọt vào đây không làm gì gãy ngay — nó chỉ lặng lẽ không khớp
-- với ô nào trong lưới, và tin đó biến mất khỏi bộ lọc mà không ai hiểu vì sao.
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_day_of_week_check"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

ALTER TABLE "job_shifts" ADD CONSTRAINT "job_shifts_day_of_week_check"
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);
