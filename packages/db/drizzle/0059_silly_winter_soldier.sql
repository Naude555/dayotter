CREATE TABLE "poll_invitees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "voting_mode" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_invitees" ADD CONSTRAINT "poll_invitees_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poll_invitees_poll_email_idx" ON "poll_invitees" USING btree ("poll_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_invitees_token_idx" ON "poll_invitees" USING btree ("token");--> statement-breakpoint
CREATE INDEX "poll_invitees_poll_idx" ON "poll_invitees" USING btree ("poll_id");