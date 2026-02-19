ALTER TABLE "transactions" ALTER COLUMN "stellar_tx_hash" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "extension_requests" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "extension_requests" DROP COLUMN "requested_at";