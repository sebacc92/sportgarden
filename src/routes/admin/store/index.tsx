import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@builder.io/qwik-city";
import { eq, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { products, orders, siteSettings } from "~/db/schema";

// --- Loaders ---

export const useStoreData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  
  // Ensure site settings exist
  let settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });
  if (!settings) {
    await db.insert(siteSettings).values({
      id: 1,
      clubName: "GardenClubFutbol",
      storeEnabled: true,
    });
    settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });
  }

  // Load products & orders sorted by latest
  const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));


  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  
  return {
    products: allProducts,
    orders: allOrders,
    storeEnabled: settings?.storeEnabled !== false,
  };
});

export const useToggleStore = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    try {
      await db
        .update(siteSettings)
        .set({
          storeEnabled: data.enabled,
        })
        .where(eq(siteSettings.id, 1));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al actualizar estado de la tienda." });
    }
  },
  zod$({
    enabled: z.boolean(),
  })
);

// --- Actions ---

export const useAddProduct = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const productId = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      const file = data.imageFile as File | undefined;
      let finalImageUrl = data.imageUrl || null;

      if (file && file.size > 0) {
        const { put } = await import("@vercel/blob");
        const fileName = `product-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const blobUpload = await put(fileName, file, {
          access: "public",
          token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
        });
        finalImageUrl = blobUpload.url;
      }

      await db.insert(products).values({
        id: productId,
        name: data.name,
        description: data.description || "",
        price: data.price,
        stock: data.stock,
        imageUrl: finalImageUrl,
        isActive: true,
      });
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al guardar el producto." });
    }
  },
  zod$({
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().optional(),
    price: z.number().min(0, "El precio no puede ser negativo"),
    stock: z.number().int().min(0, "El stock no puede ser negativo"),
    imageUrl: z.string().optional(),
    imageFile: z.any().optional(),
  })
);

export const useEditProduct = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    try {
      const file = data.imageFile as File | undefined;
      let finalImageUrl = data.imageUrl || null;

      if (file && file.size > 0) {
        const { put } = await import("@vercel/blob");
        const fileName = `product-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const blobUpload = await put(fileName, file, {
          access: "public",
          token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
        });
        finalImageUrl = blobUpload.url;
      }

      await db
        .update(products)
        .set({
          name: data.name,
          description: data.description || "",
          price: data.price,
          stock: data.stock,
          imageUrl: finalImageUrl,
          isActive: data.isActive,
        })
        .where(eq(products.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al actualizar el producto." });
    }
  },
  zod$({
    id: z.string().min(1),
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().optional(),
    price: z.number().min(0, "El precio no puede ser negativo"),
    stock: z.number().int().min(0, "El stock no puede ser negativo"),
    imageUrl: z.string().optional(),
    imageFile: z.any().optional(),
    isActive: z.boolean(),
  })
);

export const useDeleteProduct = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    try {
      // Direct hard delete for this clean showcase, fallback soft-delete can also be used
      await db.delete(products).where(eq(products.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "No se pudo eliminar el producto debido a transacciones activas." });
    }
  },
  zod$({
    id: z.string().min(1),
  })
);

export const useUpdateOrderStatus = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    try {
      await db
        .update(orders)
        .set({
          status: data.status as "PENDING" | "COMPLETED" | "CANCELLED",
        })
        .where(eq(orders.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al cambiar el estado del pedido." });
    }
  },
  zod$({
    id: z.string().min(1),
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  })
);

export default component$(() => {
  const storeData = useStoreData();
  const addAction = useAddProduct();
  const editAction = useEditProduct();
  const deleteAction = useDeleteProduct();
  const updateOrderAction = useUpdateOrderStatus();
  const toggleStoreAction = useToggleStore();

  // Dialog & tab states
  const activeTab = useSignal<"products" | "orders">("products");
  const isAddModalOpen = useSignal(false);
  const editingProduct = useSignal<any | null>(null);
  const previewUrl = useSignal<string | null>(null);
  const storeEnabledSignal = useSignal(storeData.value.storeEnabled);

  useTask$(({ track }) => {
    track(() => editingProduct.value);
    previewUrl.value = editingProduct.value?.imageUrl || null;
  });

  // Stats
  const pendingOrdersCount = useSignal(storeData.value.orders.filter(o => o.status === "PENDING").length);
  const totalRevenue = useSignal(
    storeData.value.orders
      .filter(o => o.status === "COMPLETED")
      .reduce((sum, o) => sum + o.totalAmount, 0)
  );

  return (
    <div class="min-h-screen bg-slate-900 px-6 py-8 text-white sm:px-8">
      {/* Header section */}
      <div class="mb-8 flex flex-col items-start justify-between gap-4 border-b border-white/5 pb-6 lg:flex-row lg:items-center">
        <div>
          <h1 class="text-3xl font-black tracking-tight text-white uppercase">
            Tienda <span class="text-emerald-400">Sport Garden</span>
          </h1>
          <p class="mt-1 text-sm text-slate-400">
            Administra tus productos, indumentaria, bebidas, control de stock y pedidos de clientes.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-3 rounded-2xl bg-slate-950/40 border border-white/5 px-4 py-2.5">
            <span class="text-xs font-black tracking-widest uppercase text-slate-400">Estado Tienda:</span>
            <button
              type="button"
              onClick$={async () => {
                const nextVal = !storeEnabledSignal.value;
                await toggleStoreAction.submit({ enabled: nextVal });
                storeEnabledSignal.value = nextVal;
              }}
              disabled={toggleStoreAction.isRunning}
              class={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                storeEnabledSignal.value ? "bg-emerald-500" : "bg-slate-700"
              ]}
            >
              <span
                class={[
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  storeEnabledSignal.value ? "translate-x-5" : "translate-x-0"
                ]}
              />
            </button>
            <span class={[
              "text-xs font-black uppercase tracking-wider",
              storeEnabledSignal.value ? "text-emerald-400" : "text-slate-400"
            ]}>
              {storeEnabledSignal.value ? "Activa" : "Pausada"}
            </span>
          </div>

          <button
            onClick$={() => {
              editingProduct.value = null;
              isAddModalOpen.value = true;
            }}
            class="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-500 hover:-translate-y-0.5 active:scale-95"
          >
            <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Metrics Cards row */}
      <div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div class="rounded-3xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-md">
          <div class="text-xs font-black tracking-widest text-slate-500 uppercase">Productos Activos</div>
          <div class="mt-2 text-3xl font-black text-white">
            {storeData.value.products.filter(p => p.isActive).length}
          </div>
        </div>

        <div class="rounded-3xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-md">
          <div class="text-xs font-black tracking-widest text-slate-500 uppercase">Pedidos Pendientes</div>
          <div class="mt-2 text-3xl font-black text-amber-400">
            {pendingOrdersCount.value}
          </div>
        </div>

        <div class="rounded-3xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-md">
          <div class="text-xs font-black tracking-widest text-slate-500 uppercase">Recaudación Total (Entregados)</div>
          <div class="mt-2 text-3xl font-black text-emerald-400">
            ${totalRevenue.value.toLocaleString("es-AR")} ARS
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div class="mb-6 flex border-b border-white/5 text-sm font-bold">
        <button
          onClick$={() => (activeTab.value = "products")}
          class={[
            "px-6 py-4.5 border-b-2 transition-all uppercase tracking-wider",
            activeTab.value === "products"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white",
          ]}
        >
          Productos ({storeData.value.products.length})
        </button>
        <button
          onClick$={() => (activeTab.value = "orders")}
          class={[
            "px-6 py-4.5 border-b-2 transition-all uppercase tracking-wider",
            activeTab.value === "orders"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white",
          ]}
        >
          Pedidos de Clientes ({storeData.value.orders.length})
        </button>
      </div>

      {/* Tab: Products Grid view */}
      {activeTab.value === "products" && (
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {storeData.value.products.length === 0 ? (
            <div class="col-span-full rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-400">
              <svg class="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 class="text-base font-extrabold text-slate-200">No hay productos en catálogo</h3>
              <p class="text-xs mt-1">Crea tu primer producto para visualizarlo en la landing page del club.</p>
            </div>
          ) : (
            storeData.value.products.map((product) => (
              <div
                key={product.id}
                class={[
                  "group relative overflow-hidden rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between",
                  product.isActive
                    ? "border-white/5 bg-slate-950/30 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/10"
                    : "border-white/5 bg-slate-950/10 opacity-60",
                ]}
              >
                <div>
                  {/* Image Placeholder or Actual Image */}
                  <div class="relative h-44 w-full overflow-hidden rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center mb-4">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <svg class="h-10 w-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    <span
                      class={[
                        "absolute right-3 top-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full",
                        product.stock > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
                      ]}
                    >
                      {product.stock > 0 ? `Stock: ${product.stock}` : "Sin stock"}
                    </span>
                  </div>

                  <h3 class="text-lg font-extrabold text-white tracking-tight leading-tight group-hover:text-emerald-400 transition-colors">
                    {product.name}
                  </h3>
                  <p class="text-xs text-slate-400 mt-1 line-clamp-2 min-h-8">
                    {product.description || "Sin descripción proporcionada."}
                  </p>
                </div>

                <div class="mt-4 border-t border-white/5 pt-4 flex items-center justify-between">
                  <div>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Precio</span>
                    <span class="text-xl font-black text-white">${product.price.toLocaleString("es-AR")}</span>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      onClick$={() => {
                        editingProduct.value = product;
                        isAddModalOpen.value = true;
                      }}
                      class="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                      title="Editar"
                    >
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick$={async () => {
                        if (window.confirm("¿Estás seguro de que deseas eliminar este producto?")) {
                          await deleteAction.submit({ id: product.id });
                        }
                      }}
                      class="rounded-xl border border-red-500/10 bg-red-500/5 p-2.5 text-red-400 transition-all hover:bg-red-500/10"
                      title="Eliminar"
                      stoppropagation:click
                    >
                      <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Orders List view */}
      {activeTab.value === "orders" && (
        <div class="space-y-4">
          {storeData.value.orders.length === 0 ? (
            <div class="rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-400">
              <svg class="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 class="text-base font-extrabold text-slate-200">No hay pedidos recibidos</h3>
              <p class="text-xs mt-1">Los pedidos ingresados por los clientes en la landing aparecerán listados aquí.</p>
            </div>
          ) : (
            storeData.value.orders.map((order) => {
              const parsedItems = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
              const itemList = parsedItems as Array<{ name: string; quantity: number; price: number }>;

              return (
                <div
                  key={order.id}
                  class="overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-md flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
                >
                  <div class="space-y-3.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-xs text-slate-400 font-bold uppercase">{order.id}</span>
                      <span
                        class={[
                          "text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase",
                          order.status === "PENDING" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          order.status === "COMPLETED" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                          order.status === "CANCELLED" && "bg-red-500/10 text-red-400 border border-red-500/20",
                        ]}
                      >
                        {order.status === "PENDING" ? "Pendiente" : order.status === "COMPLETED" ? "Entregado" : "Cancelado"}
                      </span>
                      <span class="text-xs text-slate-500 font-semibold">
                        {new Date(order.createdAt).toLocaleString("es-AR")}
                      </span>
                    </div>

                    <div class="space-y-1">
                      <h4 class="text-base font-extrabold text-white">{order.customerName}</h4>
                      <div class="flex items-center gap-4 text-xs text-slate-400 font-semibold">
                        <span class="flex items-center gap-1.5">
                          <svg class="h-4.5 w-4.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <a href={`tel:${order.customerPhone}`} class="hover:text-white transition-colors">{order.customerPhone}</a>
                        </span>
                        {order.customerEmail && (
                          <span class="flex items-center gap-1.5">
                            <svg class="h-4 w-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <a href={`mailto:${order.customerEmail}`} class="hover:text-white transition-colors">{order.customerEmail}</a>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detailed items table */}
                    <div class="rounded-xl border border-white/5 bg-slate-950/80 p-3 space-y-1.5">
                      <div class="text-[10px] font-black tracking-widest text-slate-500 uppercase border-b border-white/5 pb-1">Artículos</div>
                      {itemList.map((item, idx) => (
                        <div key={idx} class="flex items-center justify-between gap-4 text-xs font-semibold text-slate-300">
                          <span>
                            {item.name} <span class="text-[10px] text-emerald-400 ml-1.5 font-bold">x{item.quantity}</span>
                          </span>
                          <span class="font-mono text-white">${(item.price * item.quantity).toLocaleString("es-AR")}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div class="flex flex-col items-start gap-4 shrink-0 sm:items-end sm:justify-between h-full min-h-24">
                    <div class="text-left sm:text-right">
                      <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Pedido</span>
                      <span class="text-xl font-black text-emerald-400">${order.totalAmount.toLocaleString("es-AR")} ARS</span>
                    </div>

                    {order.status === "PENDING" && (
                      <div class="flex items-center gap-2">
                        <Form action={updateOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <input type="hidden" name="status" value="COMPLETED" />
                          <button
                            type="submit"
                            class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black tracking-widest text-white uppercase transition-all hover:bg-emerald-500 active:scale-95"
                          >
                            Entregar
                          </button>
                        </Form>

                        <Form action={updateOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <input type="hidden" name="status" value="CANCELLED" />
                          <button
                            type="submit"
                            class="rounded-xl bg-slate-800 border border-white/10 px-4 py-2 text-xs font-black tracking-widest text-red-400 uppercase transition-all hover:bg-slate-700 active:scale-95"
                          >
                            Cancelar
                          </button>
                        </Form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Product ADD / EDIT Modal dialog */}
      {isAddModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div class="w-full max-w-lg overflow-hidden rounded-3xl border border-white/5 bg-slate-900 shadow-2xl animate-scale-up">
            <div class="border-b border-white/5 p-6 flex items-center justify-between">
              <h3 class="text-lg font-black tracking-tight text-white uppercase">
                {editingProduct.value ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <button
                onClick$={() => (isAddModalOpen.value = false)}
                class="rounded-xl p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <Form
              action={editingProduct.value ? editAction : addAction}
              onSubmitCompleted$={() => {
                isAddModalOpen.value = false;
                editingProduct.value = null;
                previewUrl.value = null;
              }}
              enctype="multipart/form-data"
              class="p-6 space-y-4 text-left"
            >
              {editingProduct.value && (
                <input type="hidden" name="id" value={editingProduct.value.id} />
              )}

              {/* Product Name */}
              <div class="flex flex-col space-y-1">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre del Producto</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={editingProduct.value?.name || ""}
                  placeholder="ej. Camiseta Titular Sport Garden, Gatorade Manzana"
                  class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                />
              </div>

              {/* Description */}
              <div class="flex flex-col space-y-1">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Descripción</label>
                <textarea
                  name="description"
                  rows={2}
                  value={editingProduct.value?.description || ""}
                  placeholder="Detalles sobre talle, presentación, sabor..."
                  class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                ></textarea>
              </div>

              {/* Price & Stock inline */}
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Precio (ARS)</label>
                  <input
                    type="number"
                    name="price"
                    required
                    step="0.01"
                    min="0"
                    value={editingProduct.value?.price || ""}
                    placeholder="3500"
                    class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                  />
                </div>

                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Stock</label>
                  <input
                    type="number"
                    name="stock"
                    required
                    min="0"
                    value={editingProduct.value?.stock ?? ""}
                    placeholder="25"
                    class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Image Upload Dropzone / Button with Preview */}
              <div class="flex flex-col space-y-2">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Imagen del Producto</label>
                
                {/* Preview Thumbnail */}
                {previewUrl.value ? (
                  <div class="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 flex items-center justify-center group">
                    <img
                      src={previewUrl.value}
                      alt="Vista previa del producto"
                      class="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick$={() => {
                        previewUrl.value = null;
                      }}
                      class="absolute top-2 right-2 rounded-xl bg-red-600 p-2 text-white transition-all hover:bg-red-500 hover:scale-105 active:scale-95 shadow-lg"
                      title="Remover imagen"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick$={() => {
                      const input = document.getElementById("productImageInput");
                      input?.click();
                    }}
                    class="h-40 w-full border border-dashed border-white/10 rounded-2xl bg-slate-950/40 hover:bg-slate-950/60 hover:border-emerald-500/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200"
                  >
                    <svg class="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span class="text-xs font-bold text-slate-400">Seleccionar Imagen</span>
                    <span class="text-[10px] text-slate-600 font-bold uppercase">PNG, JPG, WEBP de hasta 5MB</span>
                  </div>
                )}

                <input
                  id="productImageInput"
                  type="file"
                  name="imageFile"
                  accept="image/*"
                  class="hidden"
                  onChange$={(e, el) => {
                    const file = el.files?.[0];
                    if (file) {
                      previewUrl.value = URL.createObjectURL(file);
                    }
                  }}
                />

                {/* Keep existing image URL if we already have one and don't upload a new one */}
                <input
                  type="hidden"
                  name="imageUrl"
                  value={previewUrl.value && !previewUrl.value.startsWith("blob:") ? previewUrl.value : ""}
                />
              </div>

              {/* Is Active Status (Only when editing) */}
              {editingProduct.value && (
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={editingProduct.value.isActive}
                    class="h-4.5 w-4.5 rounded border-white/10 bg-slate-950 text-emerald-500 accent-emerald-500"
                  />
                  <label for="isActive" class="text-xs font-bold text-slate-400 uppercase tracking-widest">Producto Activo / Disponible</label>
                </div>
              )}

              {/* Submit Buttons */}
              <div class="pt-4 flex items-center justify-end gap-3 border-t border-white/5 mt-4">
                <button
                  type="button"
                  onClick$={() => (isAddModalOpen.value = false)}
                  class="rounded-2xl bg-slate-800 border border-white/10 px-6 py-3.5 text-xs font-black tracking-widest text-slate-300 uppercase transition-all hover:bg-slate-700 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black tracking-widest text-white uppercase transition-all hover:bg-emerald-500 active:scale-95"
                >
                  {editingProduct.value ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});
