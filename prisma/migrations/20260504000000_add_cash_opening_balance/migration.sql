-- Add cashOpeningBalance to CompanySettings for Daily Cash Flow page
ALTER TABLE "CompanySettings" ADD COLUMN "cashOpeningBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
