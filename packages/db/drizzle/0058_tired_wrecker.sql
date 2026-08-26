ALTER TABLE "team_members" ADD COLUMN "public_bookable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "internal_bookable" boolean DEFAULT true NOT NULL;