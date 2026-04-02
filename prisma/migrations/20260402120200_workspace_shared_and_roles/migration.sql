-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "workspace_snapshots" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_snapshots_pkey" PRIMARY KEY ("id")
);

-- Espace nuage unique : reprendre la copie utilisateur la plus récente (avant ce changement, un snapshot par compte).
WITH pick AS (
    SELECT "payload", "version", "updatedAt"
    FROM "user_snapshots"
    ORDER BY "updatedAt" DESC NULLS LAST
    LIMIT 1
)
INSERT INTO "workspace_snapshots" ("id", "payload", "version", "updatedAt")
SELECT
    'default',
    COALESCE((SELECT "payload" FROM pick), '{}'::jsonb),
    GREATEST(COALESCE((SELECT "version" FROM pick), 1), 1),
    COALESCE((SELECT "updatedAt" FROM pick), NOW());
