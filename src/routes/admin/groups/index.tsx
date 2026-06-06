import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
  server$,
} from "@builder.io/qwik-city";
import { getDB, camelize, snakize } from "~/db";
import { groups, users } from "~/db/schema";
import { Button, Modal } from "~/components/ui";

export const useGroupsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: allGroupsData, error } = await db
    .from(groups)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  const allGroups = camelize<any[]>(allGroupsData);

  return {
    groups: allGroups,
  };
});

export const useCreateGroupAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { error } = await db.from(groups).insert(
      snakize({
        id: crypto.randomUUID(),
        name: data.name,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail || null,
        balance: 0,
      })
    );

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  },
  zod$({
    name: z.string().min(1, "El nombre es obligatorio"),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
  }),
);

export const searchContactsServer = server$(async function (query: string) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);
  const pattern = `%${query}%`;

  const { data: usersData, error } = await db
    .from(users)
    .select("id, name, phone, email")
    .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }
  return camelize<any[]>(usersData);
});

export default component$(() => {
  const groupsData = useGroupsData();
  const createGroupAction = useCreateGroupAction();

  const isModalOpen = useSignal(false);
  const contactSearchTerm = useSignal("");
  const contactSearchResults = useSignal<any[]>([]);
  const isSearchingContact = useSignal(false);

  const contactNameVal = useSignal("");
  const contactPhoneVal = useSignal("");
  const contactEmailVal = useSignal("");

  // Debounced user search task
  useTask$(({ track, cleanup }) => {
    const term = track(() => contactSearchTerm.value);
    if (term.length >= 2) {
      isSearchingContact.value = true;
      const id = setTimeout(() => {
        searchContactsServer(term)
          .then((res) => {
            contactSearchResults.value = res;
            isSearchingContact.value = false;
          })
          .catch(() => {
            contactSearchResults.value = [];
            isSearchingContact.value = false;
          });
      }, 400);
      cleanup(() => clearTimeout(id));
    } else {
      contactSearchResults.value = [];
      isSearchingContact.value = false;
    }
  });

  // Reset form signals when modal changes or after successful creation
  useTask$(({ track }) => {
    const success = track(() => createGroupAction.value?.success);
    if (success) {
      isModalOpen.value = false;
      contactSearchTerm.value = "";
      contactSearchResults.value = [];
      contactNameVal.value = "";
      contactPhoneVal.value = "";
      contactEmailVal.value = "";
    }
  });

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              Cuentas Corrientes
            </h1>
            <p class="mt-1 text-slate-500">
              Administración de grupos y colegios con pago vencido.
            </p>
          </div>
          <Button
            look="primary"
            onClick$={() => {
              isModalOpen.value = true;
              contactSearchTerm.value = "";
              contactSearchResults.value = [];
              contactNameVal.value = "";
              contactPhoneVal.value = "";
              contactEmailVal.value = "";
            }}
            class="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-md shadow-emerald-100 transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo Grupo
          </Button>
        </div>

        {/* Groups List Table */}
        <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm w-full">
          <div class="overflow-auto p-0">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                  <th class="p-4">Nombre</th>
                  <th class="p-4">Contacto</th>
                  <th class="p-4 text-right">Saldo</th>
                  <th class="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="text-sm font-semibold text-slate-700">
                {groupsData.value.groups.length === 0 ? (
                  <tr>
                    <td colSpan={4} class="p-8 text-center text-slate-500">
                      No hay grupos registrados.
                    </td>
                  </tr>
                ) : (
                  groupsData.value.groups.map((g) => (
                    <tr
                      key={g.id}
                      class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                    >
                      <td class="p-4 font-black text-slate-800">{g.name}</td>
                      <td class="p-4 text-slate-500">
                        <div class="font-bold text-slate-700">{g.contactName || "-"}</div>
                        <div class="text-xs">{g.contactPhone}</div>
                        {g.contactEmail && <div class="text-xs text-slate-400">{g.contactEmail}</div>}
                      </td>
                      <td
                        class={`p-4 text-right font-black ${g.balance < 0 ? "text-red-600" : g.balance > 0 ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        ${g.balance.toFixed(2)}
                      </td>
                      <td class="p-4 text-center">
                        <Link
                          href={`/admin/groups/${g.id}/`}
                          class="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold tracking-wider text-emerald-600 uppercase hover:text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          Ver Detalles
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal para Nuevo Grupo */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="border-b border-slate-100 p-6">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-black text-slate-800">Nuevo Grupo</h2>
              <button
                type="button"
                onClick$={() => (isModalOpen.value = false)}
                class="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <Form action={createGroupAction} class="p-6 space-y-4">
            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Nombre del Grupo/Escuela *
              </label>
              <input
                type="text"
                name="name"
                required
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <hr class="border-slate-100" />

            <div class="relative">
              <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Buscar Cliente / Autocompletar Contacto
              </label>
              <div class="relative">
                <input
                  type="text"
                  value={contactSearchTerm.value}
                  onInput$={(_, el) => (contactSearchTerm.value = el.value)}
                  placeholder="Buscar por nombre, email o tel..."
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                {isSearchingContact.value && (
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
                )}
              </div>

              {contactSearchTerm.value.length >= 2 && (
                <div class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {contactSearchResults.value.length > 0 ? (
                    contactSearchResults.value.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick$={() => {
                          contactNameVal.value = item.name || "";
                          contactPhoneVal.value = item.phone || "";
                          contactEmailVal.value = item.email || "";
                          contactSearchTerm.value = "";
                          contactSearchResults.value = [];
                        }}
                        class="flex w-full flex-col border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                      >
                        <span class="text-sm font-bold text-slate-800">
                          {item.name}
                        </span>
                        <span class="text-[11px] text-slate-400 font-normal">
                          {item.phone || item.email || "Sin datos de contacto"}
                        </span>
                      </button>
                    ))
                  ) : !isSearchingContact.value ? (
                    <div class="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                      Sin resultados
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Nombre de Contacto
              </label>
              <input
                type="text"
                name="contactName"
                value={contactNameVal.value}
                onInput$={(_, el) => (contactNameVal.value = el.value)}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Teléfono
              </label>
              <input
                type="text"
                name="contactPhone"
                value={contactPhoneVal.value}
                onInput$={(_, el) => (contactPhoneVal.value = el.value)}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                Email
              </label>
              <input
                type="email"
                name="contactEmail"
                value={contactEmailVal.value}
                onInput$={(_, el) => (contactEmailVal.value = el.value)}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div class="flex gap-3 pt-4">
              <Button
                look="secondary"
                type="button"
                onClick$={() => (isModalOpen.value = false)}
                class="w-1/2 rounded-xl py-3 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Cancelar
              </Button>
              <Button
                look="primary"
                type="submit"
                disabled={createGroupAction.isRunning}
                class="w-1/2 rounded-xl bg-emerald-500 py-3 font-bold text-white hover:bg-emerald-600"
              >
                {createGroupAction.isRunning ? "Creando..." : "Crear Grupo"}
              </Button>
            </div>
          </Form>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});

export const head = {
  title: "Cuentas Corrientes - GardenClubFutbol",
};
