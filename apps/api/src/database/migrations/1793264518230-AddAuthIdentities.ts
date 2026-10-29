import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const UNUSABLE_PASSWORD_BYTES = 32;

const UNUSABLE_HASHES_PER_BATCH = 8;

const ARGON2ID_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

function unusablePasswordHash(): Promise<string> {
  return hash(randomBytes(UNUSABLE_PASSWORD_BYTES).toString('base64url'), ARGON2ID_OPTIONS);
}

export class AddAuthIdentities1793264518230 implements MigrationInterface {
  name = 'AddAuthIdentities1793264518230';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "auth"."users"
            ALTER COLUMN "password_hash" DROP NOT NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "auth"."identities" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "provider" text NOT NULL,
                "subject" text NOT NULL,
                "user_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "identities_provider_subject_key" UNIQUE ("provider", "subject"),
                CONSTRAINT "identities_user_id_provider_key" UNIQUE ("user_id", "provider"),
                CONSTRAINT "identities_provider_check" CHECK ("provider" IN ('google')),
                CONSTRAINT "identities_subject_check" CHECK (char_length("subject") BETWEEN 1 AND 255),
                CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "auth"."sign_in_nonces" (
                "nonce_hash" character(64) NOT NULL,
                "provider" text NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "sign_in_nonces_nonce_hash_check" CHECK ("nonce_hash" ~ '^[0-9a-f]{64}$'),
                CONSTRAINT "sign_in_nonces_provider_check" CHECK ("provider" IN ('google')),
                CONSTRAINT "sign_in_nonces_pkey" PRIMARY KEY ("nonce_hash")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "sign_in_nonces_expires_at_idx" ON "auth"."sign_in_nonces" ("expires_at")
        `);
    await queryRunner.query(`
            ALTER TABLE "auth"."identities"
            ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "auth"."identities" DROP CONSTRAINT "identities_user_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "auth"."sign_in_nonces_expires_at_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "auth"."sign_in_nonces"
        `);
    await queryRunner.query(`
            DROP TABLE "auth"."identities"
        `);
    const passwordlessUsers = (await queryRunner.query(
      `SELECT "id" FROM "auth"."users" WHERE "password_hash" IS NULL`,
    )) as { id: string }[];
    const userIds = passwordlessUsers.map(({ id }) => id);
    for (let start = 0; start < userIds.length; start += UNUSABLE_HASHES_PER_BATCH) {
      const batch = userIds.slice(start, start + UNUSABLE_HASHES_PER_BATCH);
      const hashes = await Promise.all(batch.map(() => unusablePasswordHash()));
      await queryRunner.query(
        `UPDATE "auth"."users" AS "users" SET "password_hash" = "batch"."password_hash"
         FROM unnest($1::uuid[], $2::text[]) AS "batch" ("id", "password_hash")
         WHERE "users"."id" = "batch"."id"`,
        [batch, hashes],
      );
    }
    await queryRunner.query(`
            ALTER TABLE "auth"."users"
            ALTER COLUMN "password_hash" SET NOT NULL
        `);
  }
}
