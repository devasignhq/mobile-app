CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'assigned', 'in_review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_issue_id" integer,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"amount_usdc" numeric(20, 7) DEFAULT '0' NOT NULL,
	"tech_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"status" "status" DEFAULT 'open' NOT NULL,
	"deadline" timestamp,
	"creator_id" uuid NOT NULL,
	"assignee_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;