ALTER TABLE "bounties" DROP CONSTRAINT "bounties_assignee_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounties_creator_id_idx" ON "bounties" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "bounties_assignee_id_idx" ON "bounties" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "bounties_status_idx" ON "bounties" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bounties_github_issue_id_key" ON "bounties" USING btree ("github_issue_id");