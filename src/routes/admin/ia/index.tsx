import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getDB, camelize, snakize } from "~/db";
import { siteSettings, chatSessions, chatMessages } from "~/db/schema";
import { LuImage, LuTrash2 } from "@qwikest/icons/lucide";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";

const DEFAULT_SETTINGS = {
  id: 1,
  aiEnabled: true,
  aiTone: "Amigable, apasionado por el fútbol, respetuoso y servicial",
  aiInstructions:
    "1. TRATO NEUTRO E INCLUSIVO: NUNCA asumas el género del usuario.\n2. CERO ALUCINACIONES: Si un usuario pregunta por disponibilidad exacta, derivalo al sistema de reservas.",
  aiKnowledge:
    "- Identidad: Somos GardenClubFutbol. Nuestro foco es brindar las mejores canchas de césped sintético e iluminación LED.",
  aiInitialGreeting:
    "Hola! Soy el Asistente de GardenClubFutbol, ¿en qué te puedo ayudar hoy?",
  aiCallToAction:
    "Para más info o reservas directas, escribinos a nuestro WhatsApp:",
  whatsappNumber: "5491144796321",
  aiAvatarUrl: null,
  updatedAt: null,
};

export const useChatSessions = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: sessionsData, error } = await db
    .from(chatSessions)
    .select(`
      id,
      created_at,
      last_active,
      chatMessages:chat_messages(count)
    `)
    .order("last_active", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const sessions = camelize<any[]>(sessionsData).map(s => ({
    id: s.id,
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    messageCount: s.chatMessages?.[0]?.count || 0
  }));

  return sessions;
});

export const useDeleteChatAction = routeAction$(async (data, requestEvent) => {
  const id = data.id as string;
  if (!id) return requestEvent.fail(400, { message: "ID no proporcionado." });

  try {
    const db = getDB(requestEvent);
    const { error: msgErr } = await db.from(chatMessages).delete().eq("session_id", id);
    if (msgErr) throw msgErr;
    const { error: sessErr } = await db.from(chatSessions).delete().eq("id", id);
    if (sessErr) throw sessErr;
    return { success: true };
  } catch (err) {
    console.error("Error deleting chat session:", err);
    return requestEvent.fail(500, {
      message: "Error interno al eliminar el chat.",
    });
  }
});

export const useSettingsLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: settingsData, error } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  const settings = camelize<any>(settingsData);

  if (!settings) {
    try {
      const { error: insertErr } = await db.from(siteSettings).insert(snakize(DEFAULT_SETTINGS));
      if (insertErr) throw insertErr;
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return settings;
});

export const useUpdateAiSettingsAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const db = getDB(requestEvent);

      let uploadedImageUrl = data.aiAvatarUrl || null;

      if (
        data.image &&
        typeof data.image === "object" &&
        (data.image as Blob).size > 0
      ) {
        const file = data.image as File;
        const fileName = `ai-avatar-${Date.now()}.webp`;
        const { url } = await put(fileName, file, {
          access: "public",
          token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
        });
        uploadedImageUrl = url;
      }

      const { error } = await db
        .from(siteSettings)
        .update(
          snakize({
            aiEnabled: data.aiEnabled === "on",
            aiTone: data.aiTone || null,
            aiInstructions: data.aiInstructions || null,
            aiKnowledge: data.aiKnowledge || null,
            aiInitialGreeting: data.aiInitialGreeting || null,
            aiCallToAction: data.aiCallToAction || null,
            whatsappNumber: data.whatsappNumber || "5491144796321",
            aiAvatarUrl: uploadedImageUrl,
            updatedAt: new Date().toISOString(),
          })
        )
        .eq("id", 1);

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (e: any) {
      console.error("Error updating AI settings:", e);
      return requestEvent.fail(500, {
        message: e.message || "Error al guardar los ajustes de IA.",
      });
    }
  },
  zod$({
    aiEnabled: z.string().optional(),
    aiTone: z.string().optional(),
    aiInstructions: z.string().optional(),
    aiKnowledge: z.string().optional(),
    aiInitialGreeting: z.string().optional(),
    aiCallToAction: z.string().optional(),
    whatsappNumber: z.string().optional(),
    aiAvatarUrl: z.string().optional(),
    image: z.any().optional(),
  }),
);

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const deleteAction = useDeleteChatAction();
  const settings = useSettingsLoader();
  const action = useUpdateAiSettingsAction();

  const activeTab = useSignal<"audit" | "config">("audit");

  const s = settings.value;

  const isCompressing = useSignal(false);
  const avatarUrl = useSignal(s.aiAvatarUrl || "");
  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    avatarUrl.value = "";
  });

  const handleSubmit = $(async (e: Event, currentTarget: HTMLFormElement) => {
    if (isCompressing.value || action.isRunning) return;

    isCompressing.value = true;
    try {
      const formData = new FormData(currentTarget);
      const imageFile = formData.get("image") as File | null;

      if (imageFile && imageFile.size > 0 && imageFile.name) {
        const options = {
          maxWidthOrHeight: 500,
          useWebWorker: true,
          fileType: "image/webp",
          initialQuality: 0.8,
        };
        const compressedBlob = await imageCompression(imageFile, options);
        const newFileName = `ai-avatar-${Date.now()}.webp`;
        const compressedFile = new File([compressedBlob], newFileName, {
          type: "image/webp",
        });

        formData.set("image", compressedFile);
      }

      await action.submit(formData);
    } catch (error) {
      console.error("Error al comprimir/subir avatar:", error);
    } finally {
      isCompressing.value = false;
    }
  });

  return (
    <div class="mx-auto max-w-6xl space-y-6 pb-20">
      <div class="space-y-4">
        <div>
          <h1 class="text-3xl font-black tracking-tight text-slate-900">
            Asistente IA
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Revisá conversaciones con el chatbot y ajustá tono, conocimiento y
            presentación del asistente.
          </p>
        </div>

        <div
          class="flex gap-1 border-b border-slate-200"
          role="tablist"
          aria-label="Secciones del asistente IA"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === "audit"}
            class={[
              "-mb-px border-b-2 px-4 py-3 text-xs font-black tracking-widest uppercase transition-colors",
              activeTab.value === "audit"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            ]}
            onClick$={() => {
              activeTab.value = "audit";
            }}
          >
            Auditoría
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === "config"}
            class={[
              "-mb-px border-b-2 px-4 py-3 text-xs font-black tracking-widest uppercase transition-colors",
              activeTab.value === "config"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            ]}
            onClick$={() => {
              activeTab.value = "config";
            }}
          >
            Configuración
          </button>
        </div>
      </div>

      {activeTab.value === "audit" && (
        <div class="space-y-6">
          {deleteAction.value?.success && (
            <div class="animate-in fade-in slide-in-from-top-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 duration-300">
              ✅ Chat eliminado exitosamente.
            </div>
          )}
          {deleteAction.value?.failed && (
            <div class="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 duration-300">
              ❌ {deleteAction.value.message}
            </div>
          )}

          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      class="px-6 py-4 text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase"
                    >
                      Fecha Inicio
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-4 text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase"
                    >
                      Última Actividad
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-4 text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase"
                    >
                      Interacción
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-4 text-right text-[10px] font-bold tracking-widest text-slate-400 uppercase"
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 bg-white">
                  {sessionsLoader.value.map((session) => (
                    <tr
                      key={session.id}
                      class="group transition-colors hover:bg-slate-50"
                    >
                      <td class="px-6 py-4 text-sm font-semibold whitespace-nowrap text-slate-700">
                        {session.createdAt
                          ? new Date(session.createdAt).toLocaleString("es-AR")
                          : "—"}
                      </td>
                      <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-500">
                        {session.lastActive
                          ? new Date(session.lastActive).toLocaleString("es-AR")
                          : "—"}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={[
                            "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase",
                            session.messageCount > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          ]}
                        >
                          {session.messageCount} mensajes
                        </span>
                      </td>
                      <td class="flex items-center justify-end gap-4 px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        <Link
                          href={`/admin/chats/${session.id}/`}
                          class="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold tracking-widest text-slate-950 uppercase shadow-sm transition-all hover:bg-slate-950 hover:text-emerald-500"
                        >
                          Ver Detalle
                        </Link>
                        <Form action={deleteAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <button
                            type="submit"
                            class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            preventdefault:click
                            onClick$={async (e, el) => {
                              if (
                                confirm(
                                  `¿Estás seguro de eliminar este chat permanentemente? Se borrarán ${session.messageCount} mensajes.`,
                                )
                              ) {
                                (
                                  el.closest("form") as HTMLFormElement
                                ).requestSubmit();
                              }
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </Form>
                      </td>
                    </tr>
                  ))}
                  {sessionsLoader.value.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        class="bg-slate-50/50 px-6 py-20 text-center text-slate-400"
                      >
                        <div class="flex flex-col items-center gap-3">
                          <div class="text-4xl opacity-30">💬</div>
                          <p class="text-xs font-bold tracking-widest uppercase">
                            No hay chats registrados aún
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab.value === "config" && (
        <div class="mx-auto w-full max-w-4xl space-y-6">
          {action.value?.success && (
            <div class="animate-in fade-in slide-in-from-top-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 duration-300">
              ✅ Ajustes de IA guardados correctamente.
            </div>
          )}
          {action.value?.failed && (
            <div class="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 duration-300">
              ❌ {action.value.message}
            </div>
          )}

          <Form
            action={action}
            class="space-y-8"
            preventdefault:submit
            onSubmit$={handleSubmit}
          >
            <input type="hidden" name="aiAvatarUrl" value={avatarUrl.value} />
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-white/10 bg-slate-950 px-8 py-5">
                <div>
                  <h2 class="flex items-center gap-2 text-xl font-bold tracking-wide text-emerald-400">
                    <span>🤖</span> AI Chatbot "GardenClubFutbol"
                  </h2>
                  <p class="mt-1 text-xs font-medium tracking-wider text-slate-400 uppercase">
                    Configuración y personalidad del asistente virtual.
                  </p>
                </div>
                <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                  <input
                    type="checkbox"
                    id="aiEnabled"
                    name="aiEnabled"
                    checked={s.aiEnabled ?? true}
                    class="h-5 w-5 cursor-pointer rounded border-slate-700 bg-slate-800 text-emerald-500 transition focus:ring-emerald-400"
                  />
                  <label
                    for="aiEnabled"
                    class="cursor-pointer text-xs font-bold tracking-widest text-white uppercase select-none"
                  >
                    Activado
                  </label>
                </div>
              </div>

              <div class="space-y-6 p-8">
                <div class="flex flex-col gap-6 md:flex-row">
                  <div class="flex shrink-0 flex-col items-center space-y-2">
                    <label class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase">
                      Avatar del Chatbot
                    </label>
                    <div class="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-100">
                      {previewUrl.value || avatarUrl.value ? (
                        <>
                          <img
                            src={previewUrl.value || avatarUrl.value}
                            alt="Avatar IA"
                            width={96}
                            height={96}
                            class="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick$={() => {
                              avatarUrl.value = "";
                              previewUrl.value = null;
                            }}
                            class="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex"
                            title="Eliminar avatar"
                          >
                            <LuTrash2 class="h-6 w-6" />
                          </button>
                        </>
                      ) : (
                        <LuImage class="h-8 w-8 text-slate-300" />
                      )}
                      {isCompressing.value && (
                        <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
                          <div class="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                        </div>
                      )}
                    </div>
                    <div class="relative mt-2">
                      <input
                        type="file"
                        name="image"
                        accept="image/*"
                        onChange$={handleFileChange}
                        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        disabled={isCompressing.value}
                      />
                      <button
                        type="button"
                        class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        {previewUrl.value || avatarUrl.value
                          ? "Cambiar foto"
                          : "Subir foto"}
                      </button>
                    </div>
                  </div>

                  <div class="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label
                        for="aiTone"
                        class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                      >
                        Tono y Personalidad
                      </label>
                      <input
                        type="text"
                        id="aiTone"
                        name="aiTone"
                        value={s.aiTone || ""}
                        placeholder="Ej: Amigable, oficial y con pasión..."
                        class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                        Define cómo se expresa el chatbot.
                      </p>
                    </div>

                    <div>
                      <label
                        for="whatsappNumber"
                        class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                      >
                        WhatsApp de Contacto
                      </label>
                      <input
                        type="text"
                        id="whatsappNumber"
                        name="whatsappNumber"
                        value={s.whatsappNumber || ""}
                        placeholder="Ej: 54911..."
                        class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                        Número internacional sin el signo +.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    for="aiInstructions"
                    class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                  >
                    Instrucciones
                  </label>
                  <textarea
                    id="aiInstructions"
                    name="aiInstructions"
                    rows={4}
                    style={{ fieldSizing: "content" }}
                    placeholder="Ingresa las instrucciones base del modelo..."
                    class="block w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {s.aiInstructions || ""}
                  </textarea>
                  <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                    Instrucciones y reglas de comportamiento fundamentales.
                  </p>
                </div>

                <div>
                  <label
                    for="aiKnowledge"
                    class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                  >
                    Conocimiento del Club
                  </label>
                  <textarea
                    id="aiKnowledge"
                    name="aiKnowledge"
                    rows={4}
                    style={{ fieldSizing: "content" }}
                    placeholder="Ingresa reglas extra para la IA..."
                    class="block w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {s.aiKnowledge || ""}
                  </textarea>
                  <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                    Información clave que la IA usará como memoria obligatoria.
                  </p>
                </div>

                <div>
                  <label
                    for="aiInitialGreeting"
                    class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                  >
                    Saludo Inicial
                  </label>
                  <textarea
                    id="aiInitialGreeting"
                    name="aiInitialGreeting"
                    rows={2}
                    style={{ fieldSizing: "content" }}
                    placeholder="Hola! Soy el Asistente de GardenClubFutbol..."
                    class="block w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {s.aiInitialGreeting || ""}
                  </textarea>
                  <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                    Mensaje inicial o primer frase que usará el chatbot.
                  </p>
                </div>

                <div>
                  <label
                    for="aiCallToAction"
                    class="mb-1.5 block text-xs font-bold tracking-widest text-slate-500 uppercase"
                  >
                    Llamado a la Acción (CTA)
                  </label>
                  <textarea
                    id="aiCallToAction"
                    name="aiCallToAction"
                    rows={2}
                    style={{ fieldSizing: "content" }}
                    placeholder="Para más info, escribinos a nuestro WhatsApp:"
                    class="block w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    {s.aiCallToAction || ""}
                  </textarea>
                  <p class="mt-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
                    Texto de cierre que la IA agregará al final de sus
                    respuestas importantes.
                  </p>
                </div>
              </div>
            </div>

            <div class="flex justify-end pt-4">
              <button
                type="submit"
                disabled={action.isRunning}
                class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-10 py-4 font-bold tracking-widest text-white uppercase shadow-md transition hover:bg-emerald-600 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {action.isRunning || isCompressing.value ? (
                  <>
                    <svg
                      class="h-5 w-5 animate-spin text-slate-950"
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
                    {isCompressing.value ? "Optimizando..." : "Guardando..."}
                  </>
                ) : (
                  "Guardar Configuración IA"
                )}
              </button>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Asistente IA | Admin | GardenClubFutbol",
};
