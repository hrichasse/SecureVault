-- Rename enum value REVIEWER -> ADMIN_COMPANY preserving existing records
ALTER TYPE "UserRole" RENAME VALUE 'REVIEWER' TO 'ADMIN_COMPANY';

-- Add enterprise identity fields to Company
ALTER TABLE "Company"
ADD COLUMN "rut" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "businessLine" TEXT,
ADD COLUMN "adminName" TEXT;

-- Store notary license info in certifications
ALTER TABLE "Certification"
ADD COLUMN "notaryLicenseNumber" TEXT;
