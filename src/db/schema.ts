// --- Enums ---
export type UserRole = "DEV" | "OWNER" | "MANAGER" | "EMPLOYEE" | "REGISTERED" | "GUEST";
export type ClientType = "INDIVIDUAL" | "GROUP" | "SCHOOL";
export type PitchType = "F5" | "F6" | "F9";
export type DepositType = "PERCENTAGE" | "FIXED";
export type BookingStatus = "PENDING_APPROVAL" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "ATTENDED";
export type BookingType = "EVENTUAL" | "FIXED" | "BIRTHDAY" | "TOURNAMENT" | "SCHOOL";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type PaywayEnvironment = "SANDBOX" | "PRODUCTION";
export type GroupTransactionType = "CHARGE" | "PAYMENT";
export type SubscriptionStatus = "PENDING" | "PAID";
export type CashRegisterStatus = "OPEN" | "CLOSED";
export type CashMovementType = "INCOME" | "EXPENSE";
export type ClubStatus = "AUTO" | "OPEN" | "CLOSED";
export type ChatMessageRole = "user" | "assistant" | "system";
export type OrderStatus = "PENDING" | "COMPLETED" | "CANCELLED";

// --- Table Name Constants (for compatibility and Supabase queries) ---
export const users = "users";
export const accounts = "accounts";
export const sessions = "sessions";
export const verificationTokens = "verification_tokens";
export const pitches = "pitches";
export const pitchOverlaps = "pitch_overlaps";
export const bookings = "bookings";
export const guestRequests = "guest_requests";
export const instagramPosts = "instagram_posts";
export const siteSettings = "site_settings";
export const chatSessions = "chat_sessions";
export const chatMessages = "chat_messages";
export const groups = "groups";
export const groupTransactions = "group_transactions";
export const students = "students";
export const studentSubscriptions = "student_subscriptions";
export const studentPayments = "student_payments";
export const cashRegisters = "cash_registers";
export const cashMovements = "cash_movements";
export const cashSessions = "cash_sessions";
export const transactions = "transactions";
export const pitchSubscriptions = "pitch_subscriptions";
export const pitchPricingRules = "pitch_pricing_rules";
export const mercadoPagoCredentials = "mercado_pago_credentials";
export const products = "products";
export const orders = "orders";

// --- TypeScript Interfaces ---
export interface User {
  id: string;
  name: string;
  email: string | null;
  password?: string | null;
  phone: string | null;
  role: UserRole;
  clientType: ClientType;
  organizationName: string | null;
  emailVerified: Date | null;
  image: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface Account {
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
}

export interface Session {
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: Date;
}

export interface Pitch {
  id: string;
  name: string;
  type: PitchType;
  isCovered: boolean;
  isLit: boolean;
  pricePerHour: number;
  peakHourStart: string | null;
  peakPricePerHour: number | null;
  depositType: DepositType;
  depositAmount: number;
  notes: string | null;
  isActive: boolean;
  imageUrl: string | null;
  sport: string;
  surface: string;
  sortOrder: number;
}

export interface PitchOverlap {
  id: string;
  pitchId: string;
  overlapPitchId: string;
}

export interface Booking {
  id: string;
  userId: string | null;
  groupId: string | null;
  isSubscription: boolean | null;
  pitchId: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  bookingType: BookingType;
  totalPrice: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  preferenceId: string | null;
  paymentId: string | null;
  paymentMethod: string;
  notes: string | null;
  extras: string[] | null;
  createdAt: Date;
}

export interface GuestRequest {
  id: string;
  bookingId: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: Date;
}

export interface InstagramPost {
  id: string;
  permalink: string;
  mediaUrl: string;
  mediaType: string | null;
  caption: string | null;
  timestamp: string | null;
}

export interface SiteSettings {
  id: number;
  aiEnabled: boolean;
  storeEnabled: boolean;
  aiTone: string | null;
  aiInstructions: string | null;
  aiKnowledge: string | null;
  aiInitialGreeting: string | null;
  aiCallToAction: string | null;
  whatsappNumber: string | null;
  aiAvatarUrl: string | null;
  clubName: string | null;
  clubAddress: string | null;
  clubPhone: string | null;
  clubStatus: ClubStatus;
  operatingHours: Array<{ day: number; isOpen: boolean; openTime: string; closeTime: string }> | null;
  services: string[] | null;
  extraServices: Array<{ name: string; price: number; icon: string }> | null;
  bankAlias: string | null;
  galleryImages: string[] | null;
  reels: Array<{ id: string; videoUrl: string; posterUrl: string; caption?: string }> | null;
  schoolCategories: Array<{ id: string; name: string; teacher: string }> | null;
  paymentMethods: Array<{ id: string; name: string; isActive: boolean }> | null;
  movementCategories: Array<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string }> | null;
  holidays: Array<{ date: string; name: string }> | null;
  landingTexts: any | null;
  heroSlides: any | null;
  promoPopup: any | null;
  mpAccessToken: string | null;
  mpRefreshToken: string | null;
  mpPublicKey: string | null;
  mpTokenExpiresAt: Date | null;
  paywaySiteId: string | null;
  paywayPublicKey: string | null;
  paywayPrivateKey: string | null;
  paywayEnvironment: PaywayEnvironment | null;
  isPaywayActive: boolean | null;
  updatedAt: Date | null;
}

export interface ChatSession {
  id: string;
  createdAt: Date;
  lastActive: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  balance: number;
  createdAt: Date;
}

export interface GroupTransaction {
  id: string;
  groupId: string;
  type: GroupTransactionType;
  amount: number;
  description: string | null;
  bookingId: string | null;
  createdAt: Date;
}

export interface Student {
  id: string;
  name: string;
  birthDate: Date | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  category: string | null;
  monthlyFee: number;
  isActive: boolean;
  createdAt: Date;
}

export interface StudentSubscription {
  id: string;
  studentId: string;
  month: number;
  year: number;
  price: number;
  status: SubscriptionStatus;
  dueDate: Date | null;
  createdAt: Date;
}

export interface StudentPayment {
  id: string;
  subscriptionId: string;
  amount: number;
  paymentMethod: string | null;
  paymentDate: Date;
}

export interface CashRegister {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  openingBalance: number;
  closingBalance: number | null;
  status: CashRegisterStatus;
  openedBy: string | null;
  closedBy: string | null;
  billCount: Record<string, number> | null;
  notes: string | null;
}

export interface CashMovement {
  id: string;
  registerId: string;
  type: CashMovementType;
  category: string;
  amount: number;
  description: string | null;
  paymentMethod: string;
  referenceId: string | null;
  createdAt: Date;
}

export interface CashSession {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  status: CashRegisterStatus;
  openedBy: string | null;
  closedBy: string | null;
}

export interface Transaction {
  id: string;
  cashSessionId: string | null;
  type: CashMovementType;
  category: string;
  amount: number;
  description: string | null;
  paymentMethod: string;
  referenceId: string | null;
  createdAt: Date;
}

export interface PitchSubscription {
  id: string;
  pitchId: string;
  userId: string | null;
  groupId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: Date | null;
  pricePerMatch: number;
  isActive: boolean;
  createdAt: Date;
}

export interface PitchPricingRule {
  id: string;
  pitchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  price: number;
}

export interface MercadoPagoCredentials {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  publicKey: string;
  userId: string;
  liveMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  totalAmount: number;
  status: OrderStatus;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  createdAt: Date;
}

// --- Lowercase Alias Types (for backward compatibility) ---
export type users = User;
export type accounts = Account;
export type sessions = Session;
export type verificationTokens = VerificationToken;
export type pitches = Pitch;
export type pitchOverlaps = PitchOverlap;
export type bookings = Booking;
export type guestRequests = GuestRequest;
export type instagramPosts = InstagramPost;
export type siteSettings = SiteSettings;
export type chatSessions = ChatSession;
export type chatMessages = ChatMessage;
export type groups = Group;
export type groupTransactions = GroupTransaction;
export type students = Student;
export type studentSubscriptions = StudentSubscription;
export type studentPayments = StudentPayment;
export type cashRegisters = CashRegister;
export type cashMovements = CashMovement;
export type cashSessions = CashSession;
export type transactions = Transaction;
export type pitchSubscriptions = PitchSubscription;
export type pitchPricingRules = PitchPricingRule;
export type mercadoPagoCredentials = MercadoPagoCredentials;
export type products = Product;
export type orders = Order;
