import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  globalAction$,
  zod$,
  z,
  Form,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { siteSettings, mercadoPagoCredentials } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave, LuCalendar } from "@qwikest/icons/lucide";
import { MercadoPagoConnectButton } from "~/components/MercadoPagoConnectButton";
import { useLocation } from "@builder.io/qwik-city";

export const useMpCredentials = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: credentialsData, error } = await db
    .from(mercadoPagoCredentials)
    .select("*")
    .eq("id", "1")
    .maybeSingle();

  if (error) throw error;
  const credentials = camelize<any>(credentialsData);

  let formattedDate: string | null = null;
  if (credentials?.createdAt) {
    let dateObj = new Date(credentials.createdAt);
    // Si la fecha representa un año anterior a 2000, es porque se guardó en segundos en SQLite. La convertimos a milisegundos.
    if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 2000) {
      const val = Number(credentials.createdAt);
      dateObj = new Date(val < 10000000000 ? val * 1000 : val);
    }

    formattedDate = dateObj.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return {
    isConnected: !!credentials,
    userId: credentials?.userId || null,
    publicKey: credentials?.publicKey || null,
    createdAt: formattedDate,
  };
});

export const useDisconnectMpAction = globalAction$(async (data, requestEvent) => {
  const db = getDB(requestEvent);
  const { error } = await db
    .from(mercadoPagoCredentials)
    .delete()
    .eq("id", "1");
  if (error) throw error;
  return { success: true };
});

export const useSiteSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  let settings = camelize<any>(settingsData);

  if (!settings) {
    // create default if doesn't exist
    const defaultHours = [
      { day: 0, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Dom
      { day: 1, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Lun
      { day: 2, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Mar
      { day: 3, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Mie
      { day: 4, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Jue
      { day: 5, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Vie
      { day: 6, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Sab
      { day: 7, isOpen: true, openTime: "08:00", closeTime: "23:00" }, // Feriado
    ];
    const { error: insertErr } = await db
      .from(siteSettings)
      .insert({
        id: 1,
        club_name: "GardenClubFutbol",
        operating_hours: defaultHours,
        services: ["Wi-Fi", "Vestuario", "Estacionamiento"],
        holidays: [],
      });
    if (insertErr) throw insertErr;

    const { data: freshSettings, error: freshErr } = await db
      .from(siteSettings)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (freshErr) throw freshErr;
    settings = camelize<any>(freshSettings);
  }

  const { data: credentialsData, error: credentialsErr } = await db
    .from(mercadoPagoCredentials)
    .select("*")
    .eq("id", "1")
    .maybeSingle();

  if (credentialsErr) throw credentialsErr;
  const credentials = camelize<any>(credentialsData);

  const mpEnv = {
    clientId: requestEvent.env.get("MP_CLIENT_ID") || "",
    redirectUri: requestEvent.env.get("MP_REDIRECT_URI") || "",
    isConnected: !!credentials || !!settings?.mpAccessToken,
    enableDisconnect: requestEvent.env.get("ENABLE_MP_DISCONNECT") === "true",
  };

  return { ...settings, mpEnv };
});

export const useSaveClubSettingsAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { error } = await db
      .from(siteSettings)
      .update({
        club_name: data.clubName,
        club_address: data.clubAddress,
        club_phone: data.clubPhone,
        bank_alias: data.bankAlias,
        operating_hours: JSON.parse(data.operatingHours as string),
        services: JSON.parse(data.services as string),
        holidays: JSON.parse(data.holidays as string),
        payway_site_id: data.paywaySiteId || null,
        payway_public_key: data.paywayPublicKey || null,
        payway_private_key: data.paywayPrivateKey || null,
        payway_environment: data.paywayEnvironment,
        is_payway_active: data.isPaywayActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) throw error;

    return { success: true };
  },
  zod$({
    clubName: z.string().optional(),
    clubAddress: z.string().optional(),
    clubPhone: z.string().optional(),
    bankAlias: z.string().optional(),
    operatingHours: z.string(), // JSON array
    services: z.string(), // JSON array
    holidays: z.string(), // JSON array
    paywaySiteId: z.string().optional().nullable(),
    paywayPublicKey: z.string().optional().nullable(),
    paywayPrivateKey: z.string().optional().nullable(),
    paywayEnvironment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
    isPaywayActive: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  }),
);

export default component$(() => {
  const settings = useSiteSettings();

  return (
    <div class="h-full overflow-auto bg-slate-50 p-8">
      {settings.value && (
        <ClubProfileSettings settings={settings.value as any} />
      )}
    </div>
  );
});

export const ClubProfileSettings = component$((props: { settings: any }) => {
  const saveAction = useSaveClubSettingsAction();
  const loc = useLocation();
  const mpCredentials = useMpCredentials();
  const disconnectAction = useDisconnectMpAction();

  const daysLabels = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Feriado",
  ];

  const initialHours = daysLabels.map((_, i) => {
    const existing = Array.isArray(props.settings?.operatingHours)
      ? props.settings.operatingHours[i]
      : null;
    return (
      existing || {
        day: i,
        isOpen: true,
        openTime: "08:00",
        closeTime: "23:00",
      }
    );
  });
  const initialServices = Array.isArray(props.settings?.services)
    ? props.settings.services
    : [];
  const initialHolidays = Array.isArray(props.settings?.holidays)
    ? props.settings.holidays
    : [];

  const activeTab = useSignal("basic");
  const clubName = useSignal(props.settings?.clubName || "");
  const clubAddress = useSignal(props.settings?.clubAddress || "");
  const clubPhone = useSignal(props.settings?.clubPhone || "");
  const bankAlias = useSignal(props.settings?.bankAlias || "");
  const paywaySiteId = useSignal(props.settings?.paywaySiteId || "");
  const paywayPublicKey = useSignal(props.settings?.paywayPublicKey || "");
  const paywayPrivateKey = useSignal(props.settings?.paywayPrivateKey || "");
  const paywayEnvironment = useSignal(props.settings?.paywayEnvironment || "SANDBOX");
  const isPaywayActive = useSignal(props.settings?.isPaywayActive || false);

  const store = useStore(
    {
      operatingHours: initialHours,
      services: initialServices as string[],
      holidays: initialHolidays as { date: string; name: string }[],
    },
    { deep: true },
  );

  const newServiceText = useSignal("");
  const newHolidayDate = useSignal("");
  const newHolidayName = useSignal("");

  const toggleDay = $((dayIndex: number) => {
    store.operatingHours[dayIndex].isOpen =
      !store.operatingHours[dayIndex].isOpen;
  });

  const updateHour = $(
    (dayIndex: number, field: "openTime" | "closeTime", value: string) => {
      store.operatingHours[dayIndex][field] = value;
    },
  );

  const addService = $(() => {
    if (newServiceText.value.trim() !== "") {
      store.services = [...store.services, newServiceText.value.trim()];
      newServiceText.value = "";
    }
  });

  const removeService = $((index: number) => {
    store.services = store.services.filter((_, i) => i !== index);
  });

  const addHoliday = $(() => {
    if (
      newHolidayDate.value.trim() !== "" &&
      newHolidayName.value.trim() !== ""
    ) {
      const exists = store.holidays.some(
        (h) => h.date === newHolidayDate.value,
      );
      if (exists) return;

      store.holidays = [
        ...store.holidays,
        {
          date: newHolidayDate.value,
          name: newHolidayName.value.trim(),
        },
      ].sort((a, b) => a.date.localeCompare(b.date));

      newHolidayDate.value = "";
      newHolidayName.value = "";
    }
  });

  const removeHoliday = $((dateToRemove: string) => {
    store.holidays = store.holidays.filter((h) => h.date !== dateToRemove);
  });

  const formatHolidayDate = $((dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        weekday: "short",
      }).format(date);
    } catch {
      return dateStr;
    }
  });

  return (
    <Form action={saveAction} class="space-y-8">
      <header class="mb-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-800">
            Perfil del Club
          </h1>
          <p class="mt-1 font-medium text-slate-500">
            Administra la información básica, horarios y feriados del club.
          </p>
        </div>
        <Button
          type="submit"
          look="primary"
          disabled={saveAction.isRunning}
          class="flex items-center gap-3 rounded-2xl px-10 py-4 font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          {saveAction.isRunning ? (
            <svg
              class="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <>
              <LuSave class="h-5 w-5" />
              Guardar Perfil
            </>
          )}
        </Button>
      </header>

      {loc.url.searchParams.get("mp_success") && (
        <div class="mb-6 animate-pulse rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
          ¡Cuenta de MercadoPago conectada exitosamente!
        </div>
      )}
      {loc.url.searchParams.get("mp_error") && (
        <div class="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
          Error al conectar MercadoPago: {loc.url.searchParams.get("mp_error")}
        </div>
      )}

      {saveAction.value?.success && (
        <div class="mb-6 animate-pulse rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
          ¡Información del club actualizada correctamente!
        </div>
      )}

      <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Hidden inputs to make sure data is always submitted regardless of current active tab */}
        <input
          type="hidden"
          name="operatingHours"
          value={JSON.stringify(store.operatingHours)}
        />
        <input
          type="hidden"
          name="services"
          value={JSON.stringify(store.services)}
        />
        <input
          type="hidden"
          name="holidays"
          value={JSON.stringify(store.holidays)}
        />

        {/* Tab Navigation */}
        <div class="mb-8 flex flex-wrap gap-2 border-b border-slate-100 pb-5">
          {[
            { id: "basic", label: "Datos Básicos", icon: "📝" },
            { id: "hours", label: "Horarios", icon: "⏰" },
            { id: "services", label: "Servicios", icon: "🌟" },
            { id: "holidays", label: "Feriados", icon: "📅" },
            { id: "mercadopago", label: "Mercado Pago", icon: "💳" },
            { id: "payway", label: "Payway", icon: "🔌" },
          ].map((tab) => {
            const isActive = activeTab.value === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick$={() => (activeTab.value = tab.id)}
                class={[
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-950/20"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/60",
                ]}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents: Hidden instead of conditional rendering to ensure inputs stay in the DOM for submission */}
        
        {/* Tab: Datos Basicos */}
        <div class={activeTab.value === "basic" ? "space-y-6 animate-fade-in max-w-xl" : "hidden"}>
          <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
            Datos Básicos
          </h3>

          <div class="space-y-5">
            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Nombre del Club
              </label>
              <input
                type="text"
                name="clubName"
                bind:value={clubName}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: Garden Club"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Dirección
              </label>
              <input
                type="text"
                name="clubAddress"
                bind:value={clubAddress}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: Pedro Moran 2379"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                name="clubPhone"
                bind:value={clubPhone}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: 1144796321"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Alias Bancario (Transferencias)
              </label>
              <input
                type="text"
                name="bankAlias"
                bind:value={bankAlias}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: club.deportes.mp"
              />
            </div>
          </div>
        </div>

        {/* Tab: Horarios */}
        <div class={activeTab.value === "hours" ? "space-y-6 animate-fade-in max-w-3xl" : "hidden"}>
          <div>
            <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Horarios de Atención
            </h3>
            <p class="mt-1 text-xs font-medium text-slate-500">
              Define los días y franjas en que el club está abierto al público.
            </p>
          </div>

          <div class="overflow-hidden rounded-2xl border border-emerald-100 shadow-sm">
            <div class="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 bg-emerald-600 p-4 text-center text-sm font-bold text-white">
              <div class="text-left">Día</div>
              <div>Abierto</div>
              <div>Desde</div>
              <div>Hasta</div>
            </div>
            <div class="divide-y divide-emerald-50 bg-white">
              {daysLabels.map((dayName, i) => {
                const dayData = store.operatingHours[i];
                return (
                  <div
                    key={i}
                    class={[
                      "grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-4 p-3 transition-colors",
                      !dayData.isOpen && "bg-slate-50 opacity-60",
                    ]}
                  >
                    <div class="text-sm font-bold text-slate-700">
                      {dayName}
                    </div>
                    <div class="flex justify-center">
                      <input
                        type="checkbox"
                        checked={dayData.isOpen}
                        onChange$={() => toggleDay(i)}
                        class="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={dayData.openTime}
                        onInput$={(e) => {
                          let val = (
                            e.target as HTMLInputElement
                          ).value.replace(/[^0-9:]/g, "");
                          if (val.length === 2 && !val.includes(":"))
                            val += ":";
                          if (val.length > 5) val = val.substring(0, 5);
                          updateHour(i, "openTime", val);
                        }}
                        placeholder="08:00"
                        maxLength={5}
                        disabled={!dayData.isOpen}
                        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={dayData.closeTime}
                        onInput$={(e) => {
                          let val = (
                            e.target as HTMLInputElement
                          ).value.replace(/[^0-9:]/g, "");
                          if (val.length === 2 && !val.includes(":"))
                            val += ":";
                          if (val.length > 5) val = val.substring(0, 5);
                          updateHour(i, "closeTime", val);
                        }}
                        placeholder="23:00"
                        maxLength={5}
                        disabled={!dayData.isOpen}
                        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab: Servicios */}
        <div class={activeTab.value === "services" ? "flex h-full flex-col space-y-6 animate-fade-in max-w-xl" : "hidden"}>
          <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
            Servicios Ofrecidos
          </h3>

          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newServiceText}
              onKeyDown$={(e) =>
                e.key === "Enter" && (e.preventDefault(), addService())
              }
              placeholder="Ej: Buffet, Vestuarios..."
              class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <Button
              type="button"
              onClick$={addService}
              look="primary"
              class="flex items-center justify-center rounded-xl px-4 active:scale-95"
            >
              <LuPlus class="h-5 w-5" />
            </Button>
          </div>

          <ul class="mt-4 max-h-[500px] flex-1 space-y-2 overflow-y-auto pr-2">
            {store.services.map((svc, index) => (
              <li
                key={index}
                class="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <span class="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <div class="h-2 w-2 rounded-full bg-emerald-500 transition-transform group-hover:scale-125"></div>
                  {svc}
                </span>
                <button
                  type="button"
                  onClick$={() => removeService(index)}
                  class="p-1 text-slate-400 transition-colors hover:text-red-500"
                >
                  <LuTrash2 class="h-4 w-4" />
                </button>
              </li>
            ))}
            {store.services.length === 0 && (
              <div class="rounded-2xl border-2 border-dashed border-slate-100 py-8 text-center text-sm text-slate-400 italic">
                No hay servicios añadidos aún.
              </div>
            )}
          </ul>
        </div>

        {/* Tab: Feriados */}
        <div class={activeTab.value === "holidays" ? "flex h-full flex-col space-y-6 animate-fade-in max-w-xl" : "hidden"}>
          <div>
            <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Feriados del Año
            </h3>
            <p class="mt-1 text-xs font-medium text-slate-500">
              Registra días festivos no laborables para aplicar automáticamente las tarifas y horarios de feriados.
            </p>
          </div>

          <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <label class="mb-1 block text-xs font-black text-slate-700">
                Fecha del Feriado
              </label>
              <input
                type="date"
                bind:value={newHolidayDate}
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-black text-slate-700">
                Nombre / Descripción
              </label>
              <input
                type="text"
                bind:value={newHolidayName}
                onKeyDown$={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addHoliday())
                }
                placeholder="Ej: Día de la Independencia"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <Button
              type="button"
              onClick$={addHoliday}
              look="primary"
              class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold tracking-wider uppercase active:scale-95"
            >
              <LuPlus class="h-4 w-4" />
              Agregar Feriado
            </Button>
          </div>

          <ul class="mt-4 max-h-[360px] flex-1 space-y-2 overflow-y-auto pr-2">
            {store.holidays.map((h, index) => (
              <li
                key={index}
                class="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-emerald-200"
              >
                <div class="space-y-1">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black tracking-wider text-emerald-800 uppercase">
                    <LuCalendar class="h-3.5 w-3.5" />
                    {formatHolidayDate(h.date)}
                  </span>
                  <h4 class="pt-1 text-sm leading-tight font-bold text-slate-700">
                    {h.name}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick$={() => removeHoliday(h.date)}
                  class="self-center p-1 text-slate-400 transition-colors hover:text-red-500"
                >
                  <LuTrash2 class="h-4 w-4" />
                </button>
              </li>
            ))}
            {store.holidays.length === 0 && (
              <div class="rounded-2xl border-2 border-dashed border-slate-100 py-8 text-center text-sm text-slate-400 italic">
                No hay feriados registrados aún.
              </div>
            )}
          </ul>
        </div>

        {/* Tab: Mercado Pago */}
        <div class={activeTab.value === "mercadopago" ? "space-y-6 animate-fade-in max-w-xl" : "hidden"}>
          <div>
            <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Mercado Pago
            </h3>
            <p class="mt-1 text-xs font-medium text-slate-500">
              Habilita los pagos digitales automáticos y señas para las reservas online del club.
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-sm">
            {mpCredentials.value.isConnected ? (
              <div class="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <div class="flex items-center justify-center gap-2 text-emerald-700 font-bold">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 shrink-0 text-emerald-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Cuenta Vinculada</span>
                </div>
                {mpCredentials.value.userId && (
                  <p class="mt-3 text-xs font-semibold text-slate-700">
                    ID de Vendedor: <span class="font-mono bg-white px-2.5 py-1 rounded border border-slate-200/60 shadow-sm">{mpCredentials.value.userId}</span>
                  </p>
                )}
                {mpCredentials.value.createdAt && (
                  <p class="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Vinculada el: {mpCredentials.value.createdAt}
                  </p>
                )}
                {props.settings.mpEnv?.enableDisconnect && (
                  <button
                    type="button"
                    onClick$={async () => {
                      if (confirm("¿Estás seguro de que deseas desconectar la cuenta de Mercado Pago?")) {
                        await disconnectAction.submit({});
                      }
                    }}
                    disabled={disconnectAction.isRunning}
                    class="mt-4 block w-full text-center text-xs font-bold text-red-500 hover:text-red-700 transition-colors focus:outline-none disabled:opacity-50 active:scale-95"
                  >
                    {disconnectAction.isRunning ? "Desconectando..." : "Desconectar cuenta"}
                  </button>
                )}
              </div>
            ) : (
              <div class="space-y-4 py-2">
                <MercadoPagoConnectButton
                  clientId={props.settings.mpEnv?.clientId || ""}
                  redirectUri={props.settings.mpEnv?.redirectUri || ""}
                  isConnected={false}
                />
                <p class="text-center text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase">
                  Habilita pagos automáticos y señas
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tab: Payway */}
        <div class={activeTab.value === "payway" ? "space-y-6 animate-fade-in max-w-xl" : "hidden"}>
          <div>
            <h3 class="text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Credenciales Payway
            </h3>
            <p class="mt-1 text-xs font-medium text-slate-500">
              Configura la pasarela de pagos alternativa Payway (Decidir v2) con credenciales estáticas por comercio.
            </p>
          </div>

          <div class="space-y-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-sm">
            {/* Activar pasarela toggle */}
            <div class="flex items-center justify-between border-b border-slate-200/60 pb-4">
              <div>
                <label class="block text-sm font-black text-slate-800">
                  Activar Payway
                </label>
                <p class="text-xs text-slate-500">
                  Habilita Payway como pasarela de pago activa para reservas.
                </p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  name="isPaywayActive"
                  value="true"
                  checked={isPaywayActive.value}
                  onChange$={(e, el) => {
                    isPaywayActive.value = el.checked;
                  }}
                  class="peer sr-only"
                />
                <div class="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none font-bold"></div>
              </label>
            </div>

            {/* Site ID */}
            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Site ID
              </label>
              <input
                type="text"
                name="paywaySiteId"
                bind:value={paywaySiteId}
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: 00123456"
              />
            </div>

            {/* Public Key */}
            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Public Key
              </label>
              <input
                type="text"
                name="paywayPublicKey"
                bind:value={paywayPublicKey}
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Ej: d8a8fbca-..."
              />
            </div>

            {/* Private API Key */}
            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Private API Key
              </label>
              <input
                type="password"
                name="paywayPrivateKey"
                bind:value={paywayPrivateKey}
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>

            {/* Entorno / Environment */}
            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Entorno
              </label>
              <select
                name="paywayEnvironment"
                bind:value={paywayEnvironment}
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="SANDBOX">Sandbox (Pruebas)</option>
                <option value="PRODUCTION">Producción</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </Form>
  );
});

export const head = {
  title: "Perfil del Club - Admin",
};
