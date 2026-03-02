/*
  Warnings:

  - You are about to drop the `AdminProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LabInchargeProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdminProfile" DROP CONSTRAINT "AdminProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "LabInchargeProfile" DROP CONSTRAINT "LabInchargeProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceProfile" DROP CONSTRAINT "ServiceProfile_userId_fkey";

-- DropTable
DROP TABLE "AdminProfile";

-- DropTable
DROP TABLE "LabInchargeProfile";

-- DropTable
DROP TABLE "ServiceProfile";
