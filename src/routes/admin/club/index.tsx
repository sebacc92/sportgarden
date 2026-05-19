import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  Form,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave, LuCalendar } from "@qwikest/icons/lucide";

export const useSiteSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  let settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });

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
    await db.insert(siteSettings).values({
      id: 1,
      clubName: "GardenClubFutbol",
      operatingHours: defaultHours,
      services: ["Wi-Fi", "Vestuario", "Estacionamiento"],
      holidays: [],
    });
    settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1),
    });
  }

  return settings;
});

export const useSaveClubSettingsAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    await db
      .update(siteSettings)
      .set({
        clubName: data.clubName,
        clubAddress: data.clubAddress,
        clubPhone: data.clubPhone,
        bankAlias: data.bankAlias,
        operatingHours: JSON.parse(data.operatingHours as string),
        services: JSON.parse(data.services as string),
        holidays: JSON.parse(data.holidays as string),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));

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

  const clubName = useSignal(props.settings?.clubName || "");
  const clubAddress = useSignal(props.settings?.clubAddress || "");
  const clubPhone = useSignal(props.settings?.clubPhone || "");
  const bankAlias = useSignal(props.settings?.bankAlias || "");

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
            Perfil del Complejo
          </h1>
          <p class="mt-1 font-medium text-slate-500">
            Administra la información básica, horarios y feriados del complejo.
          </p>
        </div>
        <Button
          type="submit"
          look="primary"
          disabled={saveAction.isRunning}
          class="flex items-center gap-3 rounded-2xl px-10 py-4 font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20"
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

      {saveAction.value?.success && (
        <div class="animate-pulse rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
          ¡Información del complejo actualizada correctamente!
        </div>
      )}

      <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
          {/* Basic Data */}
          <div class="space-y-6">
            <h3 class="mb-4 text-lg text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Datos Básicos
            </h3>

            <div>
              <label class="mb-2 block text-sm font-black text-slate-800">
                Nombre del Complejo
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

            <div class="border-t border-slate-100 pt-8">
              <button
                type="button"
                class="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#009EE3] py-4 text-sm font-black tracking-widest text-white uppercase shadow-md shadow-blue-200 transition-all hover:bg-[#0086C3] active:scale-[0.98]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="shrink-0"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
                    fill="currentColor"
                  />
                  <path
                    d="M11 17L17 11L15.59 9.59L11 14.17L8.41 11.59L7 13L11 17Z"
                    fill="currentColor"
                  />
                </svg>
                Conectar con MercadoPago
              </button>
              <p class="mt-3 text-center text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase">
                Habilita pagos automáticos y señas
              </p>
            </div>
          </div>

          {/* Operating Hours */}
          <div class="space-y-6">
            <h3 class="mb-4 text-lg text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Horarios de Atención
            </h3>
            <p class="mb-4 text-xs font-medium text-slate-500">
              Define los días y franjas en que el complejo está abierto al
              público.
            </p>

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

          {/* Services */}
          <div class="flex h-full flex-col space-y-6">
            <h3 class="mb-4 text-lg text-sm font-bold tracking-wider text-emerald-600 uppercase">
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
                class="flex items-center justify-center rounded-xl px-4"
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

          {/* Holidays */}
          <div class="flex h-full flex-col space-y-6">
            <h3 class="mb-4 text-lg text-sm font-bold tracking-wider text-emerald-600 uppercase">
              Feriados del Año
            </h3>
            <p class="mb-4 text-xs font-medium text-slate-500">
              Registra días festivos no laborables para aplicar automáticamente
              las tarifas y horarios de feriados.
            </p>

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
                class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold tracking-wider uppercase"
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
        </div>
      </div>
    </Form>
  );
});

export const head = {
  title: "Perfil del Complejo - Admin",
};
