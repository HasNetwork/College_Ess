ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "quiet_hours_enabled" boolean DEFAULT true NOT NULL;