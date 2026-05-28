import { component$, useStore, useSignal, $ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxStock: number;
}

interface StoreSectionProps {
  products: Product[];
  checkoutAction: any;
}

export const StoreSection = component$<StoreSectionProps>(({ products, checkoutAction }) => {
  // Reactive cart store
  const cart = useStore<{ items: CartItem[] }>({ items: [] });
  const isCartDrawerOpen = useSignal(false);
  const isCheckoutModalOpen = useSignal(false);

  // Contact Info
  const customerName = useSignal("");
  const customerPhone = useSignal("");
  const customerEmail = useSignal("");

  // Helper properties
  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Cart operations
  const addToCart = $((product: Product) => {
    if (product.stock <= 0) return;
    const existing = cart.items.find((item) => item.id === product.id);
    
    if (existing) {
      if (existing.quantity < product.stock) {
        existing.quantity++;
      }
    } else {
      cart.items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        maxStock: product.stock,
      });
    }
    isCartDrawerOpen.value = true;
  });

  const updateQuantity = $((productId: string, delta: number) => {
    const item = cart.items.find((i) => i.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      cart.items = cart.items.filter((i) => i.id !== productId);
    } else if (newQty <= item.maxStock) {
      item.quantity = newQty;
    }
  });

  const clearCart = $(() => {
    cart.items = [];
    isCheckoutModalOpen.value = false;
  });

  const activeProducts = products.filter((p) => p.isActive);
  if (activeProducts.length === 0) return null;
  
  const displayProducts = activeProducts.map(p => ({ ...p, isMock: false }));

  return (
    <section id="tienda" class="relative z-20 bg-slate-950 py-24 border-t border-white/5">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section title & info */}
        <div class="mb-14 flex flex-col items-center justify-between gap-6 md:flex-row md:items-end">
          <div class="text-center md:text-left">
            <h2 class="mb-4 text-4xl font-black tracking-tighter text-white uppercase md:text-5xl">
              Tienda <span class="text-emerald-400">Oficial SG</span>
            </h2>
            <p class="mx-auto max-w-xl text-lg text-slate-400">
              Indumentaria de entrenamiento, pelotas premium, bebidas y accesorios deportivos exclusivos.
            </p>
          </div>

          {/* Cart trigger button */}
          <button
            onClick$={() => (isCartDrawerOpen.value = true)}
            class="relative flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3.5 text-sm font-black tracking-widest text-emerald-400 uppercase transition-all hover:bg-emerald-500/20 active:scale-95 shrink-0"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span>Ver Carrito</span>
            {cartItemsCount > 0 && (
              <span class="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-md animate-bounce">
                {cartItemsCount}
              </span>
            )}
          </button>
        </div>

        {/* Catalog items grid layout */}
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayProducts.map((product) => (
            <div
              key={product.id}
              class={[
                "group relative flex flex-col justify-between overflow-hidden rounded-3xl border p-5 transition-all duration-300",
                product.isMock
                  ? "border-white/5 bg-slate-900/10 opacity-70"
                  : "border-white/5 bg-slate-900/40 hover:border-emerald-500/20 hover:shadow-2xl hover:shadow-black/60",
              ]}
            >
              <div>
                {/* Product Image panel */}
                <div class="relative h-56 w-full overflow-hidden rounded-2xl bg-slate-950/80 border border-white/5 flex items-center justify-center mb-5">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <svg class="h-12 w-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                  {product.isMock && (
                    <span class="absolute left-3 top-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Próximamente
                    </span>
                  )}
                  {!product.isMock && product.stock <= 5 && product.stock > 0 && (
                    <span class="absolute left-3 top-3 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-400">
                      Últimos {product.stock}
                    </span>
                  )}
                  {!product.isMock && product.stock === 0 && (
                    <span class="absolute left-3 top-3 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-400">
                      Sin Stock
                    </span>
                  )}
                </div>

                <h3 class={[
                  "text-lg font-extrabold tracking-tight leading-tight transition-colors",
                  product.isMock ? "text-slate-300" : "text-white group-hover:text-emerald-400",
                ]}>
                  {product.name}
                </h3>
                <p class="text-xs text-slate-400 mt-1 line-clamp-2 min-h-8">
                  {product.description || "Accesorio premium oficial de Sport Garden."}
                </p>
              </div>

              {/* Price & Action button footer */}
              <div class="mt-5 border-t border-white/5 pt-4 flex items-center justify-between">
                <div>
                  <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Precio</span>
                  <span class="text-xl font-black text-white">${product.price.toLocaleString("es-AR")}</span>
                </div>

                <button
                  type="button"
                  onClick$={() => {
                    if (product.isMock) return;
                    addToCart(product as any);
                  }}
                  disabled={product.stock <= 0 || product.isMock}
                  class={[
                    "rounded-xl px-4 py-2.5 text-xs font-black tracking-widest uppercase transition-all active:scale-95 flex items-center gap-1.5",
                    product.stock > 0 && !product.isMock
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed",
                  ]}
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {product.isMock ? "Próximamente" : "Añadir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reactive Cart Drawer Overlay */}
      {isCartDrawerOpen.value && (
        <div class="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
          <div class="absolute inset-0 overflow-hidden">
            {/* Click outside to close drawer */}
            <div class="absolute inset-0 bg-transparent" onClick$={() => (isCartDrawerOpen.value = false)} />

            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div class="pointer-events-auto w-screen max-w-md transform bg-slate-900 border-l border-white/5 text-white shadow-2xl transition-all duration-300">
                <div class="flex h-full flex-col justify-between">
                  {/* Drawer Header */}
                  <div class="border-b border-white/5 px-6 py-6 flex items-center justify-between">
                    <h3 class="text-lg font-black tracking-tight uppercase">Carrito de Compras</h3>
                    <button
                      onClick$={() => (isCartDrawerOpen.value = false)}
                      class="rounded-xl p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      <svg class="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Drawer Body items */}
                  <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {cart.items.length === 0 ? (
                      <div class="flex flex-col items-center justify-center h-72 text-center text-slate-500">
                        <svg class="h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <h4 class="text-sm font-extrabold text-slate-300">Tu carrito está vacío</h4>
                        <p class="text-xs mt-1">Añade productos de la tienda para empezar tu compra.</p>
                      </div>
                    ) : (
                      cart.items.map((item) => (
                        <div key={item.id} class="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                          <div>
                            <h4 class="text-sm font-extrabold text-white">{item.name}</h4>
                            <span class="text-xs font-bold text-slate-500">${item.price.toLocaleString("es-AR")}</span>
                          </div>

                          <div class="flex items-center gap-3">
                            {/* Qty operations */}
                            <div class="flex items-center gap-1 rounded-xl bg-slate-900 p-1 border border-white/5">
                              <button
                                onClick$={() => updateQuantity(item.id, -1)}
                                class="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white"
                              >
                                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" d="M19.5 12h-15" />
                                </svg>
                              </button>
                              <span class="px-2.5 font-mono text-xs font-bold text-white select-none leading-none">
                                {item.quantity}
                              </span>
                              <button
                                onClick$={() => updateQuantity(item.id, 1)}
                                disabled={item.quantity >= item.maxStock}
                                class={[
                                  "flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white",
                                  item.quantity < item.maxStock ? "hover:bg-white/5" : "opacity-30 cursor-not-allowed",
                                ]}
                              >
                                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </button>
                            </div>

                            <button
                              onClick$={() => updateQuantity(item.id, -item.quantity)}
                              class="rounded-xl border border-red-500/10 bg-red-500/5 p-2.5 text-red-400 transition-all hover:bg-red-500/10"
                            >
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Drawer Footer totals */}
                  <div class="border-t border-white/5 px-6 py-6 space-y-4 bg-slate-950/60">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                      <span class="text-2xl font-black text-emerald-400">${cartTotal.toLocaleString("es-AR")} ARS</span>
                    </div>

                    <button
                      onClick$={() => {
                        isCartDrawerOpen.value = false;
                        isCheckoutModalOpen.value = true;
                      }}
                      disabled={cart.items.length === 0}
                      class={[
                        "w-full rounded-2xl py-4 text-sm font-black tracking-widest uppercase transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2",
                        cart.items.length > 0
                          ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/20"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none",
                      ]}
                    >
                      <span>Completar Pedido</span>
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Contact & Confirmation Checkout Modal */}
      {isCheckoutModalOpen.value && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md overflow-hidden rounded-3xl border border-white/5 bg-slate-900 shadow-2xl animate-scale-up text-white">
            
            {checkoutAction.value?.success ? (
              // Order placement Success screen
              <div class="p-8 text-center space-y-5">
                <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div class="space-y-1.5">
                  <h3 class="text-xl font-black uppercase tracking-tight">¡Pedido Recibido!</h3>
                  <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Hemos registrado tu solicitud con éxito. Acércate a la conserjería del club para abonar y retirar tus productos.
                  </p>
                </div>

                <div class="rounded-2xl bg-slate-950/40 p-4 border border-white/5 text-left max-h-44 overflow-y-auto space-y-1">
                  <div class="text-[9px] font-black tracking-widest text-slate-500 uppercase pb-1 border-b border-white/5 mb-1">Detalle del Pedido</div>
                  {cart.items.map((item) => (
                    <div key={item.id} class="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>{item.name} <span class="text-emerald-400 font-bold text-[10px]">x{item.quantity}</span></span>
                      <span>${(item.price * item.quantity).toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                  <div class="flex items-center justify-between text-xs font-black text-white pt-2 border-t border-white/5 mt-2">
                    <span>TOTAL</span>
                    <span class="text-emerald-400">${cartTotal.toLocaleString("es-AR")}</span>
                  </div>
                </div>

                <button
                  onClick$={clearCart}
                  class="w-full rounded-2xl bg-emerald-600 py-3.5 text-xs font-black tracking-widest text-white uppercase transition-all hover:bg-emerald-500"
                >
                  Entendido / Volver a la Tienda
                </button>
              </div>
            ) : (
              // Order placement Form screen
              <div>
                <div class="border-b border-white/5 p-6 flex items-center justify-between">
                  <h3 class="text-lg font-black tracking-tight uppercase">Datos de Entrega</h3>
                  <button
                    onClick$={() => (isCheckoutModalOpen.value = false)}
                    class="rounded-xl p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <svg class="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <Form
                  action={checkoutAction}
                  onSubmitCompleted$={() => {
                    // Handled inside Qwik action success template
                  }}
                  class="p-6 space-y-4 text-left"
                >
                  <input type="hidden" name="items" value={JSON.stringify(cart.items.map(i => ({
                    productId: i.id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                  })))} />
                  <input type="hidden" name="totalAmount" value={cartTotal.toString()} />

                  {/* Customer Name */}
                  <div class="flex flex-col space-y-1">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                    <input
                      type="text"
                      name="customerName"
                      required
                      value={customerName.value}
                      onInput$={(e, el) => (customerName.value = el.value)}
                      placeholder="ej. Juan Pérez"
                      class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Phone */}
                  <div class="flex flex-col space-y-1">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Teléfono de Contacto</label>
                    <input
                      type="tel"
                      name="customerPhone"
                      required
                      value={customerPhone.value}
                      onInput$={(e, el) => (customerPhone.value = el.value)}
                      placeholder="ej. 11 1234 5678"
                      class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Email */}
                  <div class="flex flex-col space-y-1">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Email (Opcional)</label>
                    <input
                      type="email"
                      name="customerEmail"
                      value={customerEmail.value}
                      onInput$={(e, el) => (customerEmail.value = el.value)}
                      placeholder="juan.perez@email.com"
                      class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Action response warning */}
                  {checkoutAction.value?.message && (
                    <div class="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-2xl">
                      {checkoutAction.value.message}
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div class="pt-4 flex items-center justify-end gap-3 border-t border-white/5 mt-4">
                    <button
                      type="button"
                      onClick$={() => (isCheckoutModalOpen.value = false)}
                      class="rounded-2xl bg-slate-800 border border-white/10 px-6 py-3.5 text-xs font-black tracking-widest text-slate-300 uppercase transition-all hover:bg-slate-700 active:scale-95"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={checkoutAction.isRunning}
                      class="rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black tracking-widest text-white uppercase transition-all hover:bg-emerald-500 active:scale-95 flex items-center gap-1.5"
                    >
                      {checkoutAction.isRunning ? "Enviando..." : "Confirmar Compra"}
                    </button>
                  </div>
                </Form>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
});
