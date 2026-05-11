import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Form } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave } from '@qwikest/icons/lucide';

export const useSiteSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  let settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1)
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
      clubName: "SportGarden",
      operatingHours: defaultHours,
      services: ["Wi-Fi", "Vestuario", "Estacionamiento"]
    });
    settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, 1)
    });
  }

  return settings;
});

export const useSaveClubSettingsAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    await db.update(siteSettings)
      .set({
        clubName: data.clubName,
        clubAddress: data.clubAddress,
        clubPhone: data.clubPhone,
        bankAlias: data.bankAlias,
        operatingHours: JSON.parse(data.operatingHours as string),
        services: JSON.parse(data.services as string),
        updatedAt: new Date()
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
    services: z.string() // JSON array
  })
);

export default component$(() => {
  const settings = useSiteSettings();

  return (
    <div class="p-8 overflow-auto h-full bg-slate-50">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Perfil del Complejo</h1>
        <p class="text-slate-500 mt-1 font-medium">Administra la información básica y horarios de atención.</p>
      </header>

      <section class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        {settings.value && (
          <ClubProfileSettings settings={settings.value as any} />
        )}
      </section>
    </div>
  );
});

export const ClubProfileSettings = component$((props: { settings: any }) => {
  const saveAction = useSaveClubSettingsAction();
  
  const daysLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Feriado"];
  
  const initialHours = daysLabels.map((_, i) => {
    const existing = Array.isArray(props.settings?.operatingHours) ? props.settings.operatingHours[i] : null;
    return existing || { day: i, isOpen: true, openTime: "08:00", closeTime: "23:00" };
  });
  const initialServices = Array.isArray(props.settings?.services) ? props.settings.services : [];

  const clubName = useSignal(props.settings?.clubName || "");
  const clubAddress = useSignal(props.settings?.clubAddress || "");
  const clubPhone = useSignal(props.settings?.clubPhone || "");
  const bankAlias = useSignal(props.settings?.bankAlias || "");

  const store = useStore({
    operatingHours: initialHours,
    services: initialServices as string[],
  }, { deep: true });

  const newServiceText = useSignal("");

  const toggleDay = $((dayIndex: number) => {
    store.operatingHours[dayIndex].isOpen = !store.operatingHours[dayIndex].isOpen;
  });

  const updateHour = $((dayIndex: number, field: 'openTime' | 'closeTime', value: string) => {
    store.operatingHours[dayIndex][field] = value;
  });

  const addService = $(() => {
    if (newServiceText.value.trim() !== "") {
      store.services = [...store.services, newServiceText.value.trim()];
      newServiceText.value = "";
    }
  });

  const removeService = $((index: number) => {
    store.services = store.services.filter((_, i) => i !== index);
  });

  return (
    <Form action={saveAction}>
      <input type="hidden" name="operatingHours" value={JSON.stringify(store.operatingHours)} />
      <input type="hidden" name="services" value={JSON.stringify(store.services)} />
      
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Basic Data */}
        <div class="space-y-6">
          <h3 class="text-lg font-bold text-emerald-600 mb-4 uppercase tracking-wider text-sm">Datos Básicos</h3>
          
          <div>
            <label class="block text-sm font-black text-slate-800 mb-2">Nombre del Complejo</label>
            <input 
              type="text" 
              name="clubName"
              bind:value={clubName}
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="Ej: Garden Club"
            />
          </div>

          <div>
            <label class="block text-sm font-black text-slate-800 mb-2">Dirección</label>
            <input 
              type="text" 
              name="clubAddress"
              bind:value={clubAddress}
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="Ej: Pedro Moran 2379"
            />
          </div>

          <div>
            <label class="block text-sm font-black text-slate-800 mb-2">Teléfono de Contacto</label>
            <input 
              type="text" 
              name="clubPhone"
              bind:value={clubPhone}
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="Ej: 1144796321"
            />
          </div>

          <div>
            <label class="block text-sm font-black text-slate-800 mb-2">Alias Bancario (Transferencias)</label>
            <input 
              type="text" 
              name="bankAlias"
              bind:value={bankAlias}
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="Ej: club.deportes.mp"
            />
          </div>

          <div class="pt-8 border-t border-slate-100">
            <button 
              type="button" 
              class="w-full bg-[#009EE3] hover:bg-[#0086C3] text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-md shadow-blue-200 active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
                <path d="M11 17L17 11L15.59 9.59L11 14.17L8.41 11.59L7 13L11 17Z" fill="currentColor"/>
              </svg>
              Conectar con MercadoPago
            </button>
            <p class="text-[10px] text-slate-400 mt-3 text-center font-bold uppercase tracking-[0.1em]">Habilita pagos automáticos y señas</p>
          </div>
        </div>

        {/* Operating Hours */}
        <div class="space-y-6">
          <h3 class="text-lg font-bold text-emerald-600 mb-4 uppercase tracking-wider text-sm">Horarios de Atención</h3>
          <p class="text-xs text-slate-500 mb-4 font-medium">Define los días y franjas en que el complejo está abierto al público.</p>
          
          <div class="border border-emerald-100 rounded-2xl overflow-hidden shadow-sm">
            <div class="grid grid-cols-[1fr_auto_1fr_1fr] gap-4 p-4 bg-emerald-600 text-white font-bold text-sm text-center">
              <div class="text-left">Día</div>
              <div>Abierto</div>
              <div>Desde</div>
              <div>Hasta</div>
            </div>
            <div class="divide-y divide-emerald-50 bg-white">
              {daysLabels.map((dayName, i) => {
                const dayData = store.operatingHours[i];
                return (
                  <div key={i} class={["grid grid-cols-[1fr_auto_1fr_1fr] gap-4 p-3 items-center transition-colors", !dayData.isOpen && "bg-slate-50 opacity-60"]}>
                    <div class="font-bold text-slate-700 text-sm">{dayName}</div>
                    <div class="flex justify-center">
                      <input 
                        type="checkbox" 
                        checked={dayData.isOpen}
                        onChange$={() => toggleDay(i)}
                        class="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        value={dayData.openTime}
                        onInput$={(e) => {
                          let val = (e.target as HTMLInputElement).value.replace(/[^0-9:]/g, '');
                          if (val.length === 2 && !val.includes(':')) val += ':';
                          if (val.length > 5) val = val.substring(0, 5);
                          updateHour(i, 'openTime', val)
                        }}
                        placeholder="08:00"
                        maxLength={5}
                        disabled={!dayData.isOpen}
                        class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        value={dayData.closeTime}
                        onInput$={(e) => {
                          let val = (e.target as HTMLInputElement).value.replace(/[^0-9:]/g, '');
                          if (val.length === 2 && !val.includes(':')) val += ':';
                          if (val.length > 5) val = val.substring(0, 5);
                          updateHour(i, 'closeTime', val)
                        }}
                        placeholder="23:00"
                        maxLength={5}
                        disabled={!dayData.isOpen}
                        class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Services */}
        <div class="space-y-6 flex flex-col h-full">
          <h3 class="text-lg font-bold text-emerald-600 mb-4 uppercase tracking-wider text-sm">Servicios Ofrecidos</h3>
          
          <div class="flex gap-2">
            <input 
              type="text"
              bind:value={newServiceText}
              onKeyDown$={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
              placeholder="Ej: Buffet, Vestuarios..."
              class="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
            />
            <Button type="button" onClick$={addService} look="primary" class="rounded-xl px-4 flex items-center justify-center">
              <LuPlus class="w-5 h-5" />
            </Button>
          </div>

          <ul class="space-y-2 mt-4 max-h-[500px] overflow-y-auto pr-2 flex-1">
            {store.services.map((svc, index) => (
              <li key={index} class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl group">
                <span class="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform"></div>
                  {svc}
                </span>
                <button 
                  type="button" 
                  onClick$={() => removeService(index)}
                  class="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  <LuTrash2 class="w-4 h-4" />
                </button>
              </li>
            ))}
            {store.services.length === 0 && (
              <div class="text-center text-slate-400 italic text-sm py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                No hay servicios añadidos aún.
              </div>
            )}
          </ul>
        </div>
      </div>

      <div class="mt-12 flex justify-end">
        <Button 
          type="submit" 
          look="primary" 
          disabled={saveAction.isRunning}
          class="px-10 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-500/20"
        >
          {saveAction.isRunning ? (
             <svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
               <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : (
            <>
              <LuSave class="w-5 h-5" />
              Guardar Perfil
            </>
          )}
        </Button>
      </div>
      
      {saveAction.value?.success && (
        <div class="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold text-center text-sm animate-pulse">
          ¡Información del complejo actualizada correctamente!
        </div>
      )}
    </Form>
  );
});

export const head = {
  title: "Perfil del Complejo - Admin",
};
