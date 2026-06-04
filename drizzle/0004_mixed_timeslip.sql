DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `site_settings` ALTER COLUMN "payway_environment" TO "payway_environment" text DEFAULT 'SANDBOX';--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `site_settings` ALTER COLUMN "is_payway_active" TO "is_payway_active" integer;