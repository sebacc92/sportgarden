import { relations } from "drizzle-orm";
import { pgTable, text, integer, doublePrecision, primaryKey, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";

// --- Enums ---
export const roleEnum = pgEnum("user_role", ["DEV", "OWNER", "MANAGER", "EMPLOYEE", "REGISTERED", "GUEST"]);
export const clientTypeEnum = pgEnum("client_type", ["INDIVIDUAL", "GROUP", "SCHOOL"]);
export const pitchTypeEnum = pgEnum("pitch_type", ["F5", "F6", "F9"]);
export const depositTypeEnum = pgEnum("deposit_type", ["PERCENTAGE", "FIXED"]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "ATTENDED"]);
export const bookingTypeEnum = pgEnum("booking_type", ["EVENTUAL", "FIXED", "BIRTHDAY", "TOURNAMENT", "SCHOOL"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PARTIAL", "PAID"]);
export const paywayEnvironmentEnum = pgEnum("payway_environment", ["SANDBOX", "PRODUCTION"]);
export const groupTransactionTypeEnum = pgEnum("group_transaction_type", ["CHARGE", "PAYMENT"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["PENDING", "PAID"]);
export const cashRegisterStatusEnum = pgEnum("cash_register_status", ["OPEN", "CLOSED"]);
export const cashMovementTypeEnum = pgEnum("cash_movement_type", ["INCOME", "EXPENSE"]);
export const clubStatusEnum = pgEnum("club_status", ["AUTO", "OPEN", "CLOSED"]);
export const chatMessageRoleEnum = pgEnum("chat_message_role", ["user", "assistant", "system"]);
export const orderStatusEnum = pgEnum("order_status", ["PENDING", "COMPLETED", "CANCELLED"]);

// --- Users ---
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  password: text("password"),
  phone: text("phone"),
  role: roleEnum("role").notNull().default("GUEST"),
  clientType: clientTypeEnum("client_type").notNull().default("INDIVIDUAL"),
  organizationName: text("organization_name"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Auth.js Tables ---
export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- Pitches (Canchas) ---
export const pitches = pgTable("pitches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: pitchTypeEnum("type").notNull(),
  isCovered: boolean("is_covered").notNull().default(false),
  isLit: boolean("is_lit").notNull().default(false),
  pricePerHour: doublePrecision("price_per_hour").notNull(),
  peakHourStart: text("peak_hour_start"),
  peakPricePerHour: doublePrecision("peak_price_per_hour"),
  depositType: depositTypeEnum("deposit_type").notNull().default("PERCENTAGE"),
  depositAmount: doublePrecision("deposit_amount").notNull().default(0),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  imageUrl: text("image_url"),
  sport: text("sport").notNull().default("Fútbol"),
  surface: text("surface").notNull().default("Sintético"),
});

export const pitchOverlaps = pgTable("pitch_overlaps", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
  overlapPitchId: text("overlap_pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
});

// --- Bookings (Reservas) ---
export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  groupId: text("group_id"),
  isSubscription: boolean("is_subscription").default(false),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  endTime: timestamp("end_time", { mode: "date" }).notNull(),
  status: bookingStatusEnum("status").notNull().default("PENDING_APPROVAL"),
  bookingType: bookingTypeEnum("booking_type").notNull().default("EVENTUAL"),
  totalPrice: doublePrecision("total_price").notNull(),
  paidAmount: doublePrecision("paid_amount").notNull().default(0),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  preferenceId: text("preference_id"),
  paymentId: text("payment_id"),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  notes: text("notes"),
  extras: jsonb("extras").$type<string[]>(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Guest Requests (Solicitudes de Invitados) ---
export const guestRequests = pgTable("guest_requests", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Instagram Posts ---
export const instagramPosts = pgTable("instagram_posts", {
  id: text("id").primaryKey(),
  permalink: text("permalink").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type"),
  caption: text("caption"),
  timestamp: text("timestamp"),
});

// --- Settings & AI ---
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  storeEnabled: boolean("store_enabled").notNull().default(true),
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
  clubStatus: clubStatusEnum("club_status").notNull().default("AUTO"),
  operatingHours: jsonb("operating_hours").$type<Array<{ day: number; isOpen: boolean; openTime: string; closeTime: string }>>(),
  services: jsonb("services").$type<string[]>(),
  extraServices: jsonb("extra_services").$type<Array<{ name: string; price: number; icon: string }>>(),
  bankAlias: text("bank_alias"),
  galleryImages: jsonb("gallery_images").$type<string[]>(),
  reels: jsonb("reels").$type<Array<{ id: string; videoUrl: string; posterUrl: string; caption?: string }>>(),
  schoolCategories: jsonb("school_categories").$type<Array<{ id: string; name: string; teacher: string }>>(),
  paymentMethods: jsonb("payment_methods").$type<Array<{ id: string; name: string; isActive: boolean }>>(),
  movementCategories: jsonb("movement_categories").$type<Array<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string }>>(),
  holidays: jsonb("holidays").$type<Array<{ date: string; name: string }>>(),
  landingTexts: jsonb("landing_texts"),
  heroSlides: jsonb("hero_slides"),
  promoPopup: jsonb("promo_popup"),

  // MercadoPago Integration
  mpAccessToken: text("mp_access_token"),
  mpRefreshToken: text("mp_refresh_token"),
  mpPublicKey: text("mp_public_key"),
  mpTokenExpiresAt: timestamp("mp_token_expires_at", { mode: "date" }),

  // Payway Integration
  paywaySiteId: text("payway_site_id"),
  paywayPublicKey: text("payway_public_key"),
  paywayPrivateKey: text("payway_private_key"),
  paywayEnvironment: paywayEnvironmentEnum("payway_environment").default("SANDBOX"),
  isPaywayActive: boolean("is_payway_active").default(false),

  updatedAt: timestamp("updated_at", { mode: "date" }),
});

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  lastActive: timestamp("last_active", { mode: "date" }).notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .references(() => chatSessions.id)
    .notNull(),
  role: chatMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
});

// --- Groups (Cuentas Corrientes) ---
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  balance: doublePrecision("balance").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const groupTransactions = pgTable("group_transactions", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  type: groupTransactionTypeEnum("type").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  bookingId: text("booking_id").references(() => bookings.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Escuelita (Individual Subscriptions) ---
export const students = pgTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  birthDate: timestamp("birth_date", { mode: "date" }),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  category: text("category"),
  monthlyFee: doublePrecision("monthly_fee").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const studentSubscriptions = pgTable("student_subscriptions", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  price: doublePrecision("price").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("PENDING"),
  dueDate: timestamp("due_date", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const studentPayments = pgTable("student_payments", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => studentSubscriptions.id),
  amount: doublePrecision("amount").notNull(),
  paymentMethod: text("payment_method"),
  paymentDate: timestamp("payment_date", { mode: "date" }).notNull().defaultNow(),
});

// --- Cash Management (Caja) ---
export const cashRegisters = pgTable("cash_registers", {
  id: text("id").primaryKey(),
  openedAt: timestamp("opened_at", { mode: "date" }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { mode: "date" }),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  closingBalance: doublePrecision("closing_balance"),
  status: cashRegisterStatusEnum("status").notNull().default("OPEN"),
  openedBy: text("opened_by").references(() => users.id),
  closedBy: text("closed_by").references(() => users.id),
  billCount: jsonb("bill_count").$type<Record<string, number>>(),
  notes: text("notes"),
});

export const cashMovements = pgTable("cash_movements", {
  id: text("id").primaryKey(),
  registerId: text("register_id")
    .notNull()
    .references(() => cashRegisters.id),
  type: cashMovementTypeEnum("type").notNull(),
  category: text("category").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Cash Sessions ---
export const cashSessions = pgTable("cash_sessions", {
  id: text("id").primaryKey(),
  openedAt: timestamp("opened_at", { mode: "date" }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { mode: "date" }),
  status: cashRegisterStatusEnum("status").notNull().default("OPEN"),
  openedBy: text("opened_by").references(() => users.id),
  closedBy: text("closed_by").references(() => users.id),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  cashSessionId: text("cash_session_id").references(() => cashSessions.id),
  type: cashMovementTypeEnum("type").notNull(),
  category: text("category").notNull(),
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  paymentMethod: text("payment_method").notNull().default("CASH"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Pitch Subscriptions ---
export const pitchSubscriptions = pgTable("pitch_subscriptions", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id),
  userId: text("user_id").references(() => users.id),
  groupId: text("group_id").references(() => groups.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
  pricePerMatch: doublePrecision("price_per_match").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Pitch Pricing Rules ---
export const pitchPricingRules = pgTable("pitch_pricing_rules", {
  id: text("id").primaryKey(),
  pitchId: text("pitch_id")
    .notNull()
    .references(() => pitches.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  price: doublePrecision("price").notNull(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  cashRegistersOpened: many(cashRegisters, { relationName: "openedBy" }),
  cashRegistersClosed: many(cashRegisters, { relationName: "closedBy" }),
  cashSessionsOpened: many(cashSessions, { relationName: "cashSessionsOpenedBy" }),
  cashSessionsClosed: many(cashSessions, { relationName: "cashSessionsClosedBy" }),
  pitchSubscriptions: many(pitchSubscriptions),
  accounts: many(accounts),
  sessions: many(sessions),
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
  transactions: many(transactions),
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

export const cashSessionsRelations = relations(
  cashSessions,
  ({ one, many }) => ({
    openedByUser: one(users, {
      fields: [cashSessions.openedBy],
      references: [users.id],
      relationName: "cashSessionsOpenedBy",
    }),
    closedByUser: one(users, {
      fields: [cashSessions.closedBy],
      references: [users.id],
      relationName: "cashSessionsClosedBy",
    }),
    transactions: many(transactions),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  cashSession: one(cashSessions, {
    fields: [transactions.cashSessionId],
    references: [cashSessions.id],
  }),
  booking: one(bookings, {
    fields: [transactions.referenceId],
    references: [bookings.id],
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

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));


// --- Mercado Pago Credentials (OAuth Integration) ---
export const mercadoPagoCredentials = pgTable("mercado_pago_credentials", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  publicKey: text("public_key").notNull(),
  userId: text("user_id").notNull(),
  liveMode: boolean("live_mode").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// --- Store Products & Orders (E-commerce shop) ---
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  items: jsonb("items").$type<Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>>().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
