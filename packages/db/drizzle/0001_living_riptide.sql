CREATE TYPE "public"."scope_type" AS ENUM('platform', 'college', 'club');--> statement-breakpoint
CREATE TABLE "grant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"granted_by" uuid,
	"expires_at" timestamp with time zone,
	CONSTRAINT "grant_scope_check" CHECK (("grant"."scope_type" = 'platform' AND "grant"."scope_id" IS NULL) OR ("grant"."scope_type" != 'platform' AND "grant"."scope_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "grant" ADD CONSTRAINT "grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grant" ADD CONSTRAINT "grant_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grant_user_permission_scope_idx" ON "grant" USING btree ("user_id","permission","scope_type","scope_id") WHERE "grant"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "grant_user_id_idx" ON "grant" USING btree ("user_id") WHERE "grant"."deleted_at" IS NULL;