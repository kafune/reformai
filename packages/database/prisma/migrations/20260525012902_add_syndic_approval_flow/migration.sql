-- AlterEnum
ALTER TYPE "CaseStatus" ADD VALUE 'AWAITING_SYNDIC_APPROVAL';

-- AlterTable
ALTER TABLE "Condominium" ADD COLUMN     "requiresSyndicApproval" BOOLEAN NOT NULL DEFAULT false;
