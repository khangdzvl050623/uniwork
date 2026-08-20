-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('RECURRING', 'SEASONAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PENDING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SalaryUnit" AS ENUM ('HOUR', 'SHIFT', 'MONTH');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BUSINESS_LICENSE', 'TAX_CODE', 'ID_CARD');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "employer_profiles" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_documents" (
    "id" TEXT NOT NULL,
    "employerProfileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_skills" (
    "studentProfileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_skills_pkey" PRIMARY KEY ("studentProfileId","skillId")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "jobId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("jobId","skillId")
);

-- CreateTable
CREATE TABLE "availabilities" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slot" "TimeSlot" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_shifts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slot" "TimeSlot" NOT NULL,

    CONSTRAINT "job_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "employerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT[],
    "benefits" TEXT[],
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "salaryMin" INTEGER NOT NULL,
    "salaryMax" INTEGER NOT NULL,
    "salaryUnit" "SalaryUnit" NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL,
    "commitmentMonths" INTEGER,
    "minShiftsPerWeek" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "coverLetter" TEXT,
    "cvUrl" TEXT,
    "matchScore" INTEGER,
    "statusChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_jobs" (
    "studentProfileId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("studentProfileId","jobId")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "employer_documents_status_idx" ON "employer_documents"("status");

-- CreateIndex
CREATE INDEX "employer_documents_employerProfileId_idx" ON "employer_documents"("employerProfileId");

-- CreateIndex
CREATE INDEX "student_skills_skillId_idx" ON "student_skills"("skillId");

-- CreateIndex
CREATE INDEX "job_skills_skillId_idx" ON "job_skills"("skillId");

-- CreateIndex
CREATE INDEX "availabilities_dayOfWeek_slot_idx" ON "availabilities"("dayOfWeek", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "availabilities_studentProfileId_dayOfWeek_slot_key" ON "availabilities"("studentProfileId", "dayOfWeek", "slot");

-- CreateIndex
CREATE INDEX "job_shifts_dayOfWeek_slot_idx" ON "job_shifts"("dayOfWeek", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "job_shifts_jobId_dayOfWeek_slot_key" ON "job_shifts"("jobId", "dayOfWeek", "slot");

-- CreateIndex
CREATE INDEX "jobs_status_publishedAt_idx" ON "jobs"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "jobs_city_district_idx" ON "jobs"("city", "district");

-- CreateIndex
CREATE INDEX "jobs_employerProfileId_status_idx" ON "jobs"("employerProfileId", "status");

-- CreateIndex
CREATE INDEX "applications_studentProfileId_status_idx" ON "applications"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "applications_jobId_status_idx" ON "applications"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_jobId_studentProfileId_key" ON "applications"("jobId", "studentProfileId");

-- CreateIndex
CREATE INDEX "saved_jobs_jobId_idx" ON "saved_jobs"("jobId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_documents" ADD CONSTRAINT "employer_documents_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_shifts" ADD CONSTRAINT "job_shifts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_employerProfileId_fkey" FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
