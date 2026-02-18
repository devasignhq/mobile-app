CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text,
	"email" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
