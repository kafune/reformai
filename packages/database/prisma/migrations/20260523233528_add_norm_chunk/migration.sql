-- CreateTable
CREATE TABLE "NormChunk" (
    "id" TEXT NOT NULL,
    "norm" TEXT NOT NULL,
    "section" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NormChunk_norm_idx" ON "NormChunk"("norm");
