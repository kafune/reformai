-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_condominiumId_fkey";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "skillFileId" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "block" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
