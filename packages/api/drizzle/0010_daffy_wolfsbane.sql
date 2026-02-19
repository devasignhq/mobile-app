CREATE TYPE "public"."extension_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('bounty_funding', 'bounty_payout', 'bounty_refund');--> statement-breakpoint
CREATE TABLE "extension_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"developer_id" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"new_deadline" timestamp NOT NULL,
	"status" "extension_request_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount_usdc" numeric(20, 7) NOT NULL,
	"bounty_id" uuid,
	"stellar_tx_hash" text,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_stellar_tx_hash_unique" UNIQUE("stellar_tx_hash")
);
--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_requests_bounty_id_idx" ON "extension_requests" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "extension_requests_developer_id_idx" ON "extension_requests" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_bounty_id_idx" ON "transactions" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");