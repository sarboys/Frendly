-- CreateTable
CREATE TABLE "TokenCatalogPack" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceRub" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "best" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenCatalogPack_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN "productSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "TokenCatalogPack_active_sortOrder_idx" ON "TokenCatalogPack"("active", "sortOrder");

-- Seed current hardcoded token packs into the editable catalog.
INSERT INTO "TokenCatalogPack" ("id", "label", "description", "priceRub", "tokens", "bonus", "best", "active", "sortOrder")
VALUES
  ('p1', 'Базовый', 'Frendly Tokens: 100', 199, 100, 0, false, true, 10),
  ('p2', 'Популярный', 'Frendly Tokens: 350', 499, 350, 0, true, true, 20),
  ('p3', 'Хост', 'Frendly Tokens: 900', 999, 900, 0, false, true, 30),
  ('p4', 'Pro', 'Frendly Tokens: 2700', 2499, 2700, 0, false, true, 40)
ON CONFLICT ("id") DO NOTHING;
