CREATE TYPE "public"."booking_status" AS ENUM('PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'ATTENDED');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('EVENTUAL', 'FIXED', 'BIRTHDAY', 'TOURNAMENT', 'SCHOOL');--> statement-breakpoint
CREATE TYPE "public"."cash_movement_type" AS ENUM('INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."cash_register_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('INDIVIDUAL', 'GROUP', 'SCHOOL');--> statement-breakpoint
CREATE TYPE "public"."club_status" AS ENUM('AUTO', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."deposit_type" AS ENUM('PERCENTAGE', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."group_transaction_type" AS ENUM('CHARGE', 'PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PARTIAL', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."payway_environment" AS ENUM('SANDBOX', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."pitch_type" AS ENUM('F5', 'F6', 'F9');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('DEV', 'OWNER', 'MANAGER', 'EMPLOYEE', 'REGISTERED', 'GUEST');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('PENDING', 'PAID');--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"group_id" text,
	"is_subscription" boolean DEFAULT false,
	"pitch_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"booking_type" "booking_type" DEFAULT 'EVENTUAL' NOT NULL,
	"total_price" double precision NOT NULL,
	"paid_amount" double precision DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"preference_id" text,
	"payment_id" text,
	"payment_method" text DEFAULT 'CASH' NOT NULL,
	"notes" text,
	"extras" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"register_id" text NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"description" text,
	"payment_method" text DEFAULT 'CASH' NOT NULL,
	"reference_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" text PRIMARY KEY NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"closing_balance" double precision,
	"status" "cash_register_status" DEFAULT 'OPEN' NOT NULL,
	"opened_by" text,
	"closed_by" text,
	"bill_count" jsonb,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"status" "cash_register_status" DEFAULT 'OPEN' NOT NULL,
	"opened_by" text,
	"closed_by" text
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"last_active" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"type" "group_transaction_type" NOT NULL,
	"amount" double precision NOT NULL,
	"description" text,
	"booking_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"balance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"permalink" text NOT NULL,
	"media_url" text NOT NULL,
	"media_type" text,
	"caption" text,
	"timestamp" text
);
--> statement-breakpoint
CREATE TABLE "mercado_pago_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"live_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"total_amount" double precision NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitch_overlaps" (
	"id" text PRIMARY KEY NOT NULL,
	"pitch_id" text NOT NULL,
	"overlap_pitch_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitch_pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"pitch_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"price" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitch_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"pitch_id" text NOT NULL,
	"user_id" text,
	"group_id" text,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"price_per_match" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "pitch_type" NOT NULL,
	"is_covered" boolean DEFAULT false NOT NULL,
	"is_lit" boolean DEFAULT false NOT NULL,
	"price_per_hour" double precision NOT NULL,
	"peak_hour_start" text,
	"peak_price_per_hour" double precision,
	"deposit_type" "deposit_type" DEFAULT 'PERCENTAGE' NOT NULL,
	"deposit_amount" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"sport" text DEFAULT 'Fútbol' NOT NULL,
	"surface" text DEFAULT 'Sintético' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" double precision NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"store_enabled" boolean DEFAULT true NOT NULL,
	"ai_tone" text,
	"ai_instructions" text,
	"ai_knowledge" text,
	"ai_initial_greeting" text,
	"ai_call_to_action" text,
	"whatsapp_number" text,
	"ai_avatar_url" text,
	"club_name" text,
	"club_address" text,
	"club_phone" text,
	"club_status" "club_status" DEFAULT 'AUTO' NOT NULL,
	"operating_hours" jsonb,
	"services" jsonb,
	"extra_services" jsonb,
	"bank_alias" text,
	"gallery_images" jsonb,
	"reels" jsonb,
	"school_categories" jsonb,
	"payment_methods" jsonb,
	"movement_categories" jsonb,
	"holidays" jsonb,
	"landing_texts" jsonb,
	"hero_slides" jsonb,
	"promo_popup" jsonb,
	"mp_access_token" text,
	"mp_refresh_token" text,
	"mp_public_key" text,
	"mp_token_expires_at" timestamp,
	"payway_site_id" text,
	"payway_public_key" text,
	"payway_private_key" text,
	"payway_environment" "payway_environment" DEFAULT 'SANDBOX',
	"is_payway_active" boolean DEFAULT false,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "student_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"payment_method" text,
	"payment_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"price" double precision NOT NULL,
	"status" "subscription_status" DEFAULT 'PENDING' NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"birth_date" timestamp,
	"guardian_name" text,
	"guardian_phone" text,
	"guardian_email" text,
	"category" text,
	"monthly_fee" double precision DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"cash_session_id" text,
	"type" "cash_movement_type" NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"description" text,
	"payment_method" text DEFAULT 'CASH' NOT NULL,
	"reference_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password" text,
	"phone" text,
	"role" "user_role" DEFAULT 'GUEST' NOT NULL,
	"client_type" "client_type" DEFAULT 'INDIVIDUAL' NOT NULL,
	"organization_name" text,
	"email_verified" timestamp,
	"image" text,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "public"."pitches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_register_id_cash_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."cash_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_transactions" ADD CONSTRAINT "group_transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_transactions" ADD CONSTRAINT "group_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_requests" ADD CONSTRAINT "guest_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_overlaps" ADD CONSTRAINT "pitch_overlaps_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "public"."pitches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_overlaps" ADD CONSTRAINT "pitch_overlaps_overlap_pitch_id_pitches_id_fk" FOREIGN KEY ("overlap_pitch_id") REFERENCES "public"."pitches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_pricing_rules" ADD CONSTRAINT "pitch_pricing_rules_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "public"."pitches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_subscriptions" ADD CONSTRAINT "pitch_subscriptions_pitch_id_pitches_id_fk" FOREIGN KEY ("pitch_id") REFERENCES "public"."pitches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_subscriptions" ADD CONSTRAINT "pitch_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_subscriptions" ADD CONSTRAINT "pitch_subscriptions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_subscription_id_student_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."student_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subscriptions" ADD CONSTRAINT "student_subscriptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;