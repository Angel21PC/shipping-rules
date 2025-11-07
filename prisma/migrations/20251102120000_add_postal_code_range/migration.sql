-- AlterTable
ALTER TABLE "ShippingRule"
ADD COLUMN "destinationPostalCodeStart" TEXT;

ALTER TABLE "ShippingRule"
ADD COLUMN "destinationPostalCodeEnd" TEXT;
