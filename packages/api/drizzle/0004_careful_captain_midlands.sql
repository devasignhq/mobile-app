ALTER TABLE "applications" DROP CONSTRAINT "applications_bounty_id_bounties_id_fk";
--> statement-breakpoint
ALTER TABLE "applications" DROP CONSTRAINT "applications_applicant_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "estimated_time" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;