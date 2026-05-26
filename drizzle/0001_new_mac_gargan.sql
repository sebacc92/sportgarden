CREATE TABLE `mercado_pago_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`live_mode` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `site_settings` ADD `holidays` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `mp_access_token` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `mp_refresh_token` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `mp_public_key` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `mp_token_expires_at` integer;