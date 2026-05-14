/**
 * Valores por defecto y resolución de listas de caja desde `site_settings`.
 * Mantiene el mismo comportamiento que antes de centralizar (no unificar los dos fallbacks de medios de pago).
 */

export type PaymentMethodRow = { id: string; name: string; isActive: boolean };

export type MovementCategoryRow = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string;
};

/** Lista canónica de categorías cuando `movementCategories` está vacío o ausente. */
export const DEFAULT_MOVEMENT_CATEGORIES: MovementCategoryRow[] = [
  { id: "BOOKING", name: "Reservas", type: "INCOME", icon: "⚽" },
  { id: "SCHOOL", name: "Escuelita", type: "INCOME", icon: "🏫" },
  { id: "KIOSK", name: "Ventas Kiosco", type: "INCOME", icon: "🍿" },
  { id: "EXTRAS", name: "Alquileres Extra", type: "INCOME", icon: "🎟️" },
  { id: "OTHER_INCOME", name: "Otros Ingresos", type: "INCOME", icon: "📌" },
  { id: "MAINTENANCE", name: "Mantenimiento", type: "EXPENSE", icon: "🔧" },
  { id: "SALARY", name: "Sueldos", type: "EXPENSE", icon: "💼" },
  { id: "SERVICES", name: "Servicios", type: "EXPENSE", icon: "💡" },
  { id: "OTHER_EXPENSE", name: "Otros Gastos", type: "EXPENSE", icon: "📌" },
];

/**
 * Fallback cuando `paymentMethods` está vacío: desglose en caja actual (incluye Tarjeta).
 * Debe coincidir con la lógica histórica de `useCashData`.
 */
export const DEFAULT_PAYMENT_METHODS_ANALYTICS: PaymentMethodRow[] = [
  { id: "CASH", name: "Efectivo", isActive: true },
  { id: "TRANSFER", name: "Transferencia", isActive: true },
  { id: "CARD", name: "Tarjeta", isActive: true },
  { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
];

/**
 * Fallback en pantalla de configuración de medios (ex Cuenta Corriente, sin Tarjeta por defecto).
 */
export const DEFAULT_PAYMENT_METHODS_SETTINGS: PaymentMethodRow[] = [
  { id: "CASH", name: "Efectivo", isActive: true },
  { id: "TRANSFER", name: "Transferencia", isActive: true },
  { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
  { id: "CURRENT_ACCOUNT", name: "Cuenta Corriente", isActive: true },
];

export function resolveMovementCategories(raw: unknown): MovementCategoryRow[] {
  const list = raw as MovementCategoryRow[] | undefined;
  return Array.isArray(list) && list.length > 0 ? list : [...DEFAULT_MOVEMENT_CATEGORIES];
}

export function resolvePaymentMethodsForAnalytics(raw: unknown): PaymentMethodRow[] {
  const list = (raw || []) as PaymentMethodRow[];
  return list.length > 0 ? list : [...DEFAULT_PAYMENT_METHODS_ANALYTICS];
}

export function resolvePaymentMethodsForSettings(raw: unknown): PaymentMethodRow[] {
  const list = (raw || []) as PaymentMethodRow[];
  return list.length > 0 ? list : [...DEFAULT_PAYMENT_METHODS_SETTINGS];
}
