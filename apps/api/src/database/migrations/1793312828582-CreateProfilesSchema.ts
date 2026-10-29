import type { MigrationInterface, QueryRunner } from 'typeorm';

const SEARCH_INDEXES = [
  { name: 'profiles_handle_search_idx', column: 'handle' },
  { name: 'profiles_display_name_search_idx', column: 'display_name' },
];

export class CreateProfilesSchema1793312828582 implements MigrationInterface {
  name = 'CreateProfilesSchema1793312828582';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('profiles', true);
    await queryRunner.query(`
            CREATE TABLE "profiles"."profiles" (
                "user_id" uuid NOT NULL,
                "handle" text NOT NULL,
                "display_name" text,
                "bio" text,
                "favourite_genres" text array NOT NULL DEFAULT '{}',
                "avatar_media_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "profiles_handle_key" UNIQUE ("handle"),
                CONSTRAINT "profiles_favourite_genres_check" CHECK (cardinality("favourite_genres") <= 10),
                CONSTRAINT "profiles_bio_check" CHECK (
                    char_length("bio") BETWEEN 1 AND 300
                ),
                CONSTRAINT "profiles_display_name_check" CHECK (
                    char_length("display_name") BETWEEN 1 AND 50
                ),
                CONSTRAINT "profiles_handle_check" CHECK (
                    char_length("handle") BETWEEN 3 AND 30
                    AND "handle" ~ '^[a-z0-9]+([._][a-z0-9]+)*$'
                ),
                CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "profiles"."top_books" (
                "user_id" uuid NOT NULL,
                "position" smallint NOT NULL,
                "work_id" uuid NOT NULL,
                CONSTRAINT "top_books_user_id_work_id_key" UNIQUE ("user_id", "work_id"),
                CONSTRAINT "top_books_position_check" CHECK (
                    "position" BETWEEN 1 AND 3
                ),
                CONSTRAINT "top_books_pkey" PRIMARY KEY ("user_id", "position")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "profiles"."follows" (
                "follower_id" uuid NOT NULL,
                "followee_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "follows_not_self_check" CHECK ("follower_id" <> "followee_id"),
                CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "followee_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "follows_followee_id_created_at_idx" ON "profiles"."follows" ("followee_id", "created_at")
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."top_books"
            ADD CONSTRAINT "top_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."follows"
            ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."follows"
            ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "profiles"."profiles"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE FUNCTION "profiles"."search_normalise"(value text) RETURNS text
            LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
            RETURN lower(public.unaccent('public.unaccent'::regdictionary, value))
        `);
    for (const { name, column } of SEARCH_INDEXES) {
      await queryRunner.query(`
            CREATE INDEX "${name}" ON "profiles"."profiles"
            USING gin ("profiles"."search_normalise"("${column}") public.gin_trgm_ops)
        `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { name } of SEARCH_INDEXES.toReversed()) {
      await queryRunner.query(`DROP INDEX "profiles"."${name}"`);
    }
    await queryRunner.query(`DROP FUNCTION "profiles"."search_normalise"(text)`);
    await queryRunner.query(`
            ALTER TABLE "profiles"."follows" DROP CONSTRAINT "follows_followee_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."follows" DROP CONSTRAINT "follows_follower_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."top_books" DROP CONSTRAINT "top_books_user_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "profiles"."follows_followee_id_created_at_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "profiles"."follows"
        `);
    await queryRunner.query(`
            DROP TABLE "profiles"."top_books"
        `);
    await queryRunner.query(`
            DROP TABLE "profiles"."profiles"
        `);
    await queryRunner.dropSchema('profiles');
  }
}
