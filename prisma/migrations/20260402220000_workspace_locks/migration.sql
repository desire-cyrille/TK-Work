-- Verrous d'édition partagés (biens global, un devis, un projet rapport).
CREATE TABLE "workspace_locks" (
    "resource_key" TEXT NOT NULL,
    "holder_user_id" TEXT NOT NULL,
    "holder_email" TEXT NOT NULL,
    "holder_label" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_locks_pkey" PRIMARY KEY ("resource_key")
);
