import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// --- Users ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // We can use UUIDs or nanoids
  name: text("name").notNull(),
  email: text("email").unique(), // Can be null if it's just a guest who provided a phone
  password: text("password"), // Hashed password, null for guests
  phone: text("phone"),
  role: text("role", {
    enum: ["DEV", "OWNER", "MANAGER", "EMPLOYEE", "REGISTERED", "GUEST"],
  })
    .notNull()
    .default("GUEST"),
  clientType: text("client_type", { enum: ["INDIVIDUAL", "GROUP", "SCHOOL"] })
    .notNull()
    .default("INDIVIDUAL"),
  organizationName: text("organization_name"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Pitches (Canchas) ---
export const pitches = sqliteTable("pitches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["F5", "F6", "F9"] }).notNull(),
  isCovered: integer("is_covered", { mode: "boolean" })
    .notNull()
    .default(false),
  isLit: integer("is_lit", { mode: "boolean" }).notNull().default(false),
  pricePerHour: real("price_per_hour").notNull(),
  peakHourStart: text("peak_hour_start"), // ej: "18:00"
  peakPricePerHour: real("peak_price_per_hour"),
  depositType: text("deposit_type", { enum: ["PERCENTAGE", "FIXED"] })
    .notNull()
    .default("PERCENTAGE"),
  depositAmount: real("deposit_amount").notNull().default(0), // % or fixed amount depending on depositType
  notes: text("notes"), // Free text for admin notes/clarifications
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  imageUrl: text("image_url"),
  sport: text("sport").notNull().default("Fútbol"),
  surface: text("surface").notNull().default("Sintético"),
});
export const pitchOverlaps = sqliteTable("pitch_overlaps", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
  overlapPitchId: text("overlap_pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
});

// --- Bookings (Reservas) ---
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id), // Can be null if guest request is not yet linked to a user
  groupId: text("group_id"), // Reference to groups.id
  isSubscription: integer("is_subscription", { mode: "boolean" }).default(
    false,
  ),
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
  bookingType: text("booking_type", {
    enum: ["EVENTUAL", "FIXED", "BIRTHDAY", "TOURNAMENT", "SCHOOL"],
  })
    .notNull()
    .default("EVENTUAL"),
  totalPrice: real("total_price").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  paymentStatus: text("payment_status", {
    enum: ["PENDING", "PARTIAL", "PAID"],
  })
    .notNull()
    .default("PENDING"),
  preferenceId: text("preference_id"),
  paymentId: text("payment_id"),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  notes: text("notes"),
  extras: text("extras", { mode: "json" }), // array of extra service names
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

// --- Settings & AI ---
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey(), // We only use id = 1
  aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(true),
  aiTone: text("ai_tone"),
  aiInstructions: text("ai_instructions"),
  aiKnowledge: text("ai_knowledge"),
  aiInitialGreeting: text("ai_initial_greeting"),
  aiCallToAction: text("ai_call_to_action"),
  whatsappNumber: text("whatsapp_number"),
  aiAvatarUrl: text("ai_avatar_url"),

  // Club Info
  clubName: text("club_name"),
  clubAddress: text("club_address"),
  clubPhone: text("club_phone"),
  clubStatus: text("club_status").notNull().default("AUTO"), // 'AUTO', 'OPEN', 'CLOSED'
  operatingHours: text("operating_hours", { mode: "json" }), // array of { day: 0-6, isOpen: boolean, openTime: string, closeTime: string }
  services: text("services", { mode: "json" }), // array of strings
  extraServices: text("extra_services", { mode: "json" }), // array of { name: string, price: number, icon: string }
  bankAlias: text("bank_alias"),
  galleryImages: text("gallery_images", { mode: "json" }), // array of image URLs (max 20)
  schoolCategories: text("school_categories", { mode: "json" }), // array of { id: string, name: string, teacher: string }
  paymentMethods: text("payment_methods", { mode: "json" }), // array of { id: string, name: string, isActive: boolean }
  movementCategories: text("movement_categories", { mode: "json" }), // array of { id: string, name: string, type: 'INCOME' | 'EXPENSE', icon: string }
  holidays: text("holidays", { mode: "json" }), // array of { date: string, name: string }

  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastActive: integer("last_active", { mode: "timestamp" }).notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .references(() => chatSessions.id)
    .notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// --- Groups (Cuentas Corrientes) ---
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  balance: real("balance").notNull().default(0), // Positive means group has credit, negative means debt
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const groupTransactions = sqliteTable("group_transactions", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  type: text("type", { enum: ["CHARGE", "PAYMENT"] }).notNull(),
  amount: real("amount").notNull(), // Absolute amount
  description: text("description"),
  bookingId: text("booking_id").references(() => bookings.id), // If type=CHARGE from a booking
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Escuelita (Individual Subscriptions) ---
export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  birthDate: integer("birth_date", { mode: "timestamp" }),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  category: text("category"), // Ej: "2010/2011"
  monthlyFee: real("monthly_fee").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const studentSubscriptions = sqliteTable("student_subscriptions", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  price: real("price").notNull(),
  status: text("status", { enum: ["PENDING", "PAID"] })
    .notNull()
    .default("PENDING"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const studentPayments = sqliteTable("student_payments", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => studentSubscriptions.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method"), // "CASH", "TRANSFER", etc.
  paymentDate: integer("payment_date", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Cash Management (Caja) ---
export const cashRegisters = sqliteTable("cash_registers", {
  id: text("id").primaryKey(),
  openedAt: integer("opened_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  closedAt: integer("closed_at", { mode: "timestamp" }),
  openingBalance: real("opening_balance").notNull().default(0),
  closingBalance: real("closing_balance"),
  status: text("status", { enum: ["OPEN", "CLOSED"] })
    .notNull()
    .default("OPEN"),
  openedBy: text("opened_by").references(() => users.id),
  closedBy: text("closed_by").references(() => users.id),
  // Arqueo de billetes al cierre: { "100": 5, "500": 10, ... }
  billCount: text("bill_count", { mode: "json" }).$type<
    Record<string, number>
  >(),
  notes: text("notes"), // Observaciones del turno
});

export const cashMovements = sqliteTable("cash_movements", {
  id: text("id").primaryKey(),
  registerId: text("register_id")
    .notNull()
    .references(() => cashRegisters.id),
  type: text("type", { enum: ["INCOME", "EXPENSE"] }).notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  referenceId: text("reference_id"), // ID to booking, student_payment, group_transaction depending on category
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Pitch Subscriptions (Abonos de Canchas) ---
export const pitchSubscriptions = sqliteTable("pitch_subscriptions", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id),
  userId: text("user_id").references(() => users.id), // Abono a nombre de un usuario
  groupId: text("group_id").references(() => groups.id), // O abono a nombre de un grupo
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: text("start_time").notNull(), // "19:00"
  endTime: text("end_time").notNull(), // "20:00"
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }), // If null, it's indefinitely recurring
  pricePerMatch: real("price_per_match").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// --- Pitch Pricing Rules (Precios Dinámicos) ---
export const pitchPricingRules = sqliteTable("pitch_pricing_rules", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: text("start_time").notNull(), // format "HH:MM"
  endTime: text("end_time").notNull(), // format "HH:MM"
  price: real("price").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  cashRegistersOpened: many(cashRegisters, { relationName: "openedBy" }),
  cashRegistersClosed: many(cashRegisters, { relationName: "closedBy" }),
  pitchSubscriptions: many(pitchSubscriptions),
}));

export const pitchesRelations = relations(pitches, ({ many }) => ({
  pricingRules: many(pitchPricingRules),
  bookings: many(bookings),
  subscriptions: many(pitchSubscriptions),
  overlaps: many(pitchOverlaps, { relationName: "pitch_overlaps_pitchId" }),
  overlappedBy: many(pitchOverlaps, {
    relationName: "pitch_overlaps_overlapPitchId",
  }),
}));

export const pitchOverlapsRelations = relations(pitchOverlaps, ({ one }) => ({
  pitch: one(pitches, {
    fields: [pitchOverlaps.pitchId],
    references: [pitches.id],
    relationName: "pitch_overlaps_pitchId",
  }),
  overlapPitch: one(pitches, {
    fields: [pitchOverlaps.overlapPitchId],
    references: [pitches.id],
    relationName: "pitch_overlaps_overlapPitchId",
  }),
}));

export const pitchPricingRulesRelations = relations(
  pitchPricingRules,
  ({ one }) => ({
    pitch: one(pitches, {
      fields: [pitchPricingRules.pitchId],
      references: [pitches.id],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  pitch: one(pitches, {
    fields: [bookings.pitchId],
    references: [pitches.id],
  }),
  group: one(groups, {
    fields: [bookings.groupId],
    references: [groups.id],
  }),
  guestRequest: one(guestRequests, {
    fields: [bookings.id],
    references: [guestRequests.bookingId],
  }),
  groupTransactions: many(groupTransactions),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  transactions: many(groupTransactions),
  bookings: many(bookings),
  pitchSubscriptions: many(pitchSubscriptions),
}));

export const groupTransactionsRelations = relations(
  groupTransactions,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupTransactions.groupId],
      references: [groups.id],
    }),
    booking: one(bookings, {
      fields: [groupTransactions.bookingId],
      references: [bookings.id],
    }),
  }),
);

export const cashRegistersRelations = relations(
  cashRegisters,
  ({ one, many }) => ({
    openedByUser: one(users, {
      fields: [cashRegisters.openedBy],
      references: [users.id],
      relationName: "openedBy",
    }),
    closedByUser: one(users, {
      fields: [cashRegisters.closedBy],
      references: [users.id],
      relationName: "closedBy",
    }),
    movements: many(cashMovements),
  }),
);

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  register: one(cashRegisters, {
    fields: [cashMovements.registerId],
    references: [cashRegisters.id],
  }),
}));

export const pitchSubscriptionsRelations = relations(
  pitchSubscriptions,
  ({ one }) => ({
    pitch: one(pitches, {
      fields: [pitchSubscriptions.pitchId],
      references: [pitches.id],
    }),
    user: one(users, {
      fields: [pitchSubscriptions.userId],
      references: [users.id],
    }),
    group: one(groups, {
      fields: [pitchSubscriptions.groupId],
      references: [groups.id],
    }),
  }),
);

export const studentsRelations = relations(students, ({ many }) => ({
  subscriptions: many(studentSubscriptions),
}));

export const studentSubscriptionsRelations = relations(
  studentSubscriptions,
  ({ one }) => ({
    student: one(students, {
      fields: [studentSubscriptions.studentId],
      references: [students.id],
    }),
  }),
);
