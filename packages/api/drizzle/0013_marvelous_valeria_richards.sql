DROP INDEX "transactions_stellar_tx_hash_unique_idx";--> statement-breakpoint
CREATE INDEX "bounties_status_deadline_idx" ON "bounties" USING btree ("status","deadline");--> statement-breakpoint
CREATE INDEX "bounties_tech_tags_gin_idx" ON "bounties" USING btree ("tech_tags" USING gin);--> statement-breakpoint
CREATE INDEX "messages_recipient_pagination_idx" ON "messages" USING btree ("recipient_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "transactions_user_history_idx" ON "transactions" USING btree ("user_id","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_stellar_tx_hash_idx" ON "transactions" USING btree ("stellar_tx_hash");