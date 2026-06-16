/*
  Warnings:

  - You are about to drop the `IdeaDevelopment` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "TestType" ADD VALUE 'MODELO_NEGOCIO';

-- DropForeignKey
ALTER TABLE "IdeaDevelopment" DROP CONSTRAINT "IdeaDevelopment_assignmentId_fkey";

-- DropTable
DROP TABLE "IdeaDevelopment";
