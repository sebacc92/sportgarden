CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`group_id` text,
	`is_subscription` integer DEFAULT false,
	`pitch_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	`booking_type` text DEFAULT 'EVENTUAL' NOT NULL,
	`total_price` real NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'PENDING' NOT NULL,
	`preference_id` text,
	`payment_id` text,
	`payment_method` text DEFAULT 'CASH' NOT NULL,
	`notes` text,
	`extras` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pitch_id`) REFERENCES `pitches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`register_id` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`payment_method` text DEFAULT 'CASH' NOT NULL,
	`reference_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_registers` (
	`id` text PRIMARY KEY NOT NULL,
	`opened_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`closed_at` integer,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`closing_balance` real,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`opened_by` text,
	`closed_by` text,
	`bill_count` text,
	`notes` text,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`booking_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_phone` text,
	`contact_email` text,
	`balance` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guest_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `instagram_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`permalink` text NOT NULL,
	`media_url` text NOT NULL,
	`media_type` text,
	`caption` text,
	`timestamp` text
);
--> statement-breakpoint
CREATE TABLE `pitch_overlaps` (
	`id` text PRIMARY KEY NOT NULL,
	`pitch_id` text NOT NULL,
	`overlap_pitch_id` text NOT NULL,
	FOREIGN KEY (`pitch_id`) REFERENCES `pitches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`overlap_pitch_id`) REFERENCES `pitches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pitch_pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pitch_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`price` real NOT NULL,
	FOREIGN KEY (`pitch_id`) REFERENCES `pitches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pitch_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`pitch_id` text NOT NULL,
	`user_id` text,
	`group_id` text,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`price_per_match` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`pitch_id`) REFERENCES `pitches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pitches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`is_covered` integer DEFAULT false NOT NULL,
	`is_lit` integer DEFAULT false NOT NULL,
	`price_per_hour` real NOT NULL,
	`peak_hour_start` text,
	`peak_price_per_hour` real,
	`deposit_type` text DEFAULT 'PERCENTAGE' NOT NULL,
	`deposit_amount` real DEFAULT 0 NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`image_url` text,
	`sport` text DEFAULT 'Fútbol' NOT NULL,
	`surface` text DEFAULT 'Sintético' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`ai_enabled` integer DEFAULT true NOT NULL,
	`ai_tone` text,
	`ai_instructions` text,
	`ai_knowledge` text,
	`ai_initial_greeting` text,
	`ai_call_to_action` text,
	`whatsapp_number` text,
	`ai_avatar_url` text,
	`club_name` text,
	`club_address` text,
	`club_phone` text,
	`club_status` text DEFAULT 'AUTO' NOT NULL,
	`operating_hours` text,
	`services` text,
	`extra_services` text,
	`bank_alias` text,
	`gallery_images` text,
	`reels` text,
	`school_categories` text,
	`payment_methods` text,
	`movement_categories` text,
	`landing_texts` text,
	`hero_slides` text,
	`promo_popup` text,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `student_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_method` text,
	`payment_date` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `student_subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`price` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`due_date` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` integer,
	`guardian_name` text,
	`guardian_phone` text,
	`guardian_email` text,
	`category` text,
	`monthly_fee` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`password` text,
	`phone` text,
	`role` text DEFAULT 'GUEST' NOT NULL,
	`client_type` text DEFAULT 'INDIVIDUAL' NOT NULL,
	`organization_name` text,
	`last_login_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);