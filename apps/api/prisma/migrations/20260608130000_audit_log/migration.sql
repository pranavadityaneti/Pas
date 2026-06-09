-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actor_user_id_idx" ON "public"."audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "AuditLog_target_idx" ON "public"."audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "public"."audit_log"("created_at");

