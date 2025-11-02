-- CreateTable
CREATE TABLE "ShippingRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopDomain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "minSubtotal" DECIMAL,
    "maxSubtotal" DECIMAL,
    "minWeight" DECIMAL,
    "maxWeight" DECIMAL,
    "destinationCountry" TEXT,
    "destinationProvince" TEXT,
    "destinationPostalCode" TEXT,
    "rateName" TEXT NOT NULL,
    "rateAmountCents" INTEGER NOT NULL,
    "carrierServiceCode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ShippingRule_shopDomain_idx" ON "ShippingRule"("shopDomain");
