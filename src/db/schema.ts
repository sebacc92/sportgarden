import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// --- Users ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // We can use UUIDs or nanoids
  name: text("name").notNull(),
  email: text("email").unique(), // Can be null if it's just a guest who provided a phone
  password: text("password"), // Hashed password, null for guests
  phone: text("phone"),
  role: text("role", { enum: ["ADMIN", "REGISTERED", "GUEST"] })
    .notNull()
    .default("GUEST"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Pitches (Canchas) ---
export const pitches = sqliteTable("pitches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["F5", "F7", "F9", "F11"] }).notNull(),
  isCovered: integer("is_covered", { mode: "boolean" }).notNull().default(false),
  pricePerHour: real("price_per_hour").notNull(),
  peakHourStart: text("peak_hour_start"), // ej: "18:00"
  peakPricePerHour: real("peak_price_per_hour"),
  reservationPercentage: integer("reservation_percentage").notNull().default(0), // % to charge in advance (e.g., 50)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// --- Bookings (Reservas) ---
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id), // Can be null if guest request is not yet linked to a user
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }).notNull(),
  status: text("status", {
    enum: ["PENDING_APPROVAL", "CONFIRMED", "CANCELLED", "COMPLETED"],
  })
    .notNull()
    .default("PENDING_APPROVAL"),
  totalPrice: real("total_price").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  paymentStatus: text("payment_status", {
    enum: ["PENDING", "PARTIAL", "PAID"],
  })
    .notNull()
    .default("PENDING"),
  preferenceId: text("preference_id"),
  paymentId: text("payment_id"),
  extras: text("extras", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Guest Requests (Solicitudes de Invitados) ---
// Temporary contact info for users without an account requesting a booking
export const guestRequests = sqliteTable("guest_requests", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Instagram Posts ---
export const instagramPosts = sqliteTable("instagram_posts", {
  id: text("id").primaryKey(),
  permalink: text("permalink").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type"),
  caption: text("caption"),
  timestamp: text("timestamp"),
});
