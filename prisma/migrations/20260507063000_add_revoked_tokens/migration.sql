CREATE TABLE "revoked_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_jti" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revoked_tokens_token_jti_key" ON "revoked_tokens"("token_jti");
CREATE INDEX "revoked_tokens_user_id_idx" ON "revoked_tokens"("user_id");
CREATE INDEX "revoked_tokens_expires_at_idx" ON "revoked_tokens"("expires_at");

ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
