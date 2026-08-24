CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TABLE "booking_hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "bookings_host_slot_active_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "allow_overlap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_hosts_booking_user_idx" ON "booking_hosts" USING btree ("booking_id","user_id");--> statement-breakpoint
CREATE INDEX "booking_hosts_user_idx" ON "booking_hosts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_host_slot_active_idx" ON "bookings" USING btree ("host_id","starts_at") WHERE "bookings"."status" IN ('confirmed', 'pending') AND "bookings"."is_group" = false AND "bookings"."allow_overlap" = false;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" IN ('confirmed', 'pending') AND "is_group" = false AND "allow_overlap" = false);--> statement-breakpoint
-- Existing team event types should include members added after the event was created.
INSERT INTO "event_type_hosts" ("id", "event_type_id", "user_id", "priority", "created_at", "updated_at")
SELECT gen_random_uuid(), et."id", tm."user_id", tm."priority", now(), now()
FROM "event_types" et
JOIN "team_members" tm ON tm."team_id" = et."team_id"
WHERE et."team_id" IS NOT NULL
ON CONFLICT ("event_type_id", "user_id") DO NOTHING;--> statement-breakpoint
-- The primary host is always known on historical collective bookings.
INSERT INTO "booking_hosts" ("id", "booking_id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), b."id", b."host_id", now(), now()
FROM "bookings" b
JOIN "event_types" et ON et."id" = b."event_type_id"
WHERE et."scheduling_type" = 'collective'
ON CONFLICT ("booking_id", "user_id") DO NOTHING;--> statement-breakpoint
-- Existing collective co-hosts were stored as attendees. Reconstruct those
-- links without assigning old meetings to members who joined afterward.
INSERT INTO "booking_hosts" ("id", "booking_id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), b."id", eth."user_id", now(), now()
FROM "bookings" b
JOIN "event_types" et ON et."id" = b."event_type_id"
JOIN "event_type_hosts" eth ON eth."event_type_id" = et."id"
JOIN "users" u ON u."id" = eth."user_id"
JOIN "booking_attendees" ba ON ba."booking_id" = b."id" AND lower(ba."email") = lower(u."email")
WHERE et."scheduling_type" = 'collective'
ON CONFLICT ("booking_id", "user_id") DO NOTHING;
