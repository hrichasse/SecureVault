-- CreateEnum
CREATE TYPE "CompanyStage" AS ENUM ('LEAD', 'ONBOARDING', 'ACTIVE', 'AT_RISK', 'CHURNED');

-- AlterTable: contacto (WhatsApp) y etapa de pipeline en Company
ALTER TABLE "Company" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "stage" "CompanyStage" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable: notas / timeline del CRM
CREATE TABLE "CompanyNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNote_companyId_idx" ON "CompanyNote"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
