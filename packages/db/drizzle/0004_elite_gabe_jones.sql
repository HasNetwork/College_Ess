ALTER TABLE "link" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_platform_slug_active_idx" ON "doc" USING btree ("slug") WHERE "doc"."college_id" IS NULL AND "doc"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "grant_platform_permission_active_idx" ON "grant" USING btree ("user_id","permission") WHERE "grant"."scope_id" IS NULL AND "grant"."deleted_at" IS NULL;