-- CreateTable
CREATE TABLE "PartnerReview" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReview_caseId_key" ON "PartnerReview"("caseId");

-- CreateIndex
CREATE INDEX "PartnerReview_partnerId_idx" ON "PartnerReview"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReformCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
