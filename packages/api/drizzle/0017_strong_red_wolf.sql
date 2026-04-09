ALTER TYPE "public"."transaction_status" ADD VALUE 'pending_verification' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'withdrawal';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "public_repos" integer DEFAULT 0 NOT NULL;