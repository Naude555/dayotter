CREATE TABLE "poll_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_message_templates" ADD CONSTRAINT "poll_message_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_message_templates_user_idx" ON "poll_message_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_message_templates_user_name_idx" ON "poll_message_templates" USING btree ("user_id","name");