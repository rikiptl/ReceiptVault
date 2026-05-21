-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "merchant" TEXT,
    "date" TEXT,
    "total" TEXT,
    "tax" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT,
    "ocrText" TEXT,
    "items" JSONB DEFAULT '[]',
    "notes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "ocrDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);
