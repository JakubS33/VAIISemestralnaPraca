/*
  Warnings:

  - You are about to drop the column `price` on the `Asset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[apiId,type]` on the table `Asset` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `apiId` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Asset` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRYPTO', 'STOCK', 'ETF', 'CASH');

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "price",
ADD COLUMN     "apiId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "AssetType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_type_key" ON "Asset"("symbol", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_apiId_type_key" ON "Asset"("apiId", "type");
