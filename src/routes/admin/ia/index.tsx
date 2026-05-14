import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, Link, z, zod$, type DocumentHead } from '@builder.io/qwik-city';
import { getDB } from '~/db';
import { siteSettings, chatSessions, chatMessages } from '~/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { LuImage, LuTrash2 } from '@qwikest/icons/lucide';
import { put } from '@vercel/blob';
import imageCompression from 'browser-image-compression';

const DEFAULT_SETTINGS = {
  id: 1,
  aiEnabled: true,
  aiTone: 'Amigable, apasionado por el fútbol, respetuoso y servicial',
  aiInstructions: '1. TRATO NEUTRO E INCLUSIVO: NUNCA asumas el género del usuario.\n2. CERO ALUCINACIONES: Si un usuario pregunta por disponibilidad exacta, derivalo al sistema de reservas.',
  aiKnowledge: '- Identidad: Somos GardenClubFutbol. Nuestro foco es brindar las mejores canchas de césped sintético e iluminación LED.',
  aiInitialGreeting: 'Hola! Soy el Asistente de GardenClubFutbol, ¿en qué te puedo ayudar hoy?',
  aiCallToAction: 'Para más info o reservas directas, escribinos a nuestro WhatsApp:',
  whatsappNumber: '5491112345678',
  aiAvatarUrl: null,
  updatedAt: null,
};

export const useChatSessions = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const sessions = await db
    .select({
      id: chatSessions.id,
      createdAt: chatSessions.createdAt,
      lastActive: chatSessions.lastActive,
      messageCount: count(chatMessages.id),
    })
    .from(chatSessions)
    .leftJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.lastActive));

  return sessions;
});

export const useDeleteChatAction = routeAction$(async (data, requestEvent) => {
  const id = data.id as string;
  if (!id) return requestEvent.fail(400, { message: 'ID no proporcionado.' });

  try {
    const db = getDB(requestEvent);
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
    await db.delete(chatSessions).where(eq(chatSessions.id, id));
    return { success: true };
  } catch (err) {
    console.error('Error deleting chat session:', err);
    return requestEvent.fail(500, { message: 'Error interno al eliminar el chat.' });
  }
});

export const useSettingsLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

  if (!settings) {
    try {
      await db.insert(siteSettings).values(DEFAULT_SETTINGS);
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

      if (data.image && typeof data.image === 'object' && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const fileName = `ai-avatar-${Date.now()}.webp`;
        const { url } = await put(fileName, file, {
          access: 'public',
          token: requestEvent.env.get('BLOB_READ_WRITE_TOKEN'),
        });
        uploadedImageUrl = url;
      }

      await db
        .update(siteSettings)
        .set({
          aiEnabled: data.aiEnabled === 'on',
          aiTone: data.aiTone || null,
          aiInstructions: data.aiInstructions || null,
          aiKnowledge: data.aiKnowledge || null,
          aiInitialGreeting: data.aiInitialGreeting || null,
          aiCallToAction: data.aiCallToAction || null,
          whatsappNumber: data.whatsappNumber || '5491112345678',
          aiAvatarUrl: uploadedImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.id, 1));

      return { success: true };
    } catch (e: any) {
      console.error('Error updating AI settings:', e);
      return requestEvent.fail(500, { message: e.message || 'Error al guardar los ajustes de IA.' });
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

  const activeTab = useSignal<'audit' | 'config'>('audit');

  const s = settings.value;

  const isCompressing = useSignal(false);
  const avatarUrl = useSignal(s.aiAvatarUrl || '');
  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    avatarUrl.value = '';
  });

  const handleSubmit = $(async (e: Event, currentTarget: HTMLFormElement) => {
    if (isCompressing.value || action.isRunning) return;

    isCompressing.value = true;
    try {
      const formData = new FormData(currentTarget);
      const imageFile = formData.get('image') as File | null;

      if (imageFile && imageFile.size > 0 && imageFile.name) {
        const options = {
          maxWidthOrHeight: 500,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.8,
        };
        const compressedBlob = await imageCompression(imageFile, options);
        const newFileName = `ai-avatar-${Date.now()}.webp`;
        const compressedFile = new File([compressedBlob], newFileName, { type: 'image/webp' });

        formData.set('image', compressedFile);
      }

      await action.submit(formData);
    } catch (error) {
      console.error('Error al comprimir/subir avatar:', error);
    } finally {
      isCompressing.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto space-y-6 pb-20">
      <div class="space-y-4">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Asistente IA</h1>
          <p class="text-sm text-slate-500 mt-1">
            Revisá conversaciones con el chatbot y ajustá tono, conocimiento y presentación del asistente.
          </p>
        </div>

        <div class="flex gap-1 border-b border-slate-200" role="tablist" aria-label="Secciones del asistente IA">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === 'audit'}
            class={[
              'px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-colors',
              activeTab.value === 'audit'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ]}
            onClick$={() => {
              activeTab.value = 'audit';
            }}
          >
            Auditoría
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab.value === 'config'}
            class={[
              'px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-colors',
              activeTab.value === 'config'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ]}
            onClick$={() => {
              activeTab.value = 'config';
            }}
          >
            Configuración
          </button>
        </div>
      </div>

      {activeTab.value === 'audit' && (
        <div class="space-y-6">
          {deleteAction.value?.success && (
            <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              ✅ Chat eliminado exitosamente.
            </div>
          )}
          {deleteAction.value?.failed && (
            <div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              ❌ {deleteAction.value.message}
            </div>
          )}

          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Fecha Inicio
                    </th>
                    <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Última Actividad
                    </th>
                    <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Interacción
                    </th>
                    <th scope="col" class="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 bg-white">
                  {sessionsLoader.value.map((session) => (
                    <tr key={session.id} class="hover:bg-slate-50 transition-colors group">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                        {session.createdAt ? new Date(session.createdAt).toLocaleString('es-AR') : '—'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {session.lastActive ? new Date(session.lastActive).toLocaleString('es-AR') : '—'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={[
                            'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            session.messageCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                          ]}
                        >
                          {session.messageCount} mensajes
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-4 items-center">
                        <Link
                          href={`/admin/chats/${session.id}/`}
                          class="text-slate-950 hover:text-emerald-500 bg-slate-100 hover:bg-slate-950 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
                        >
                          Ver Detalle
                        </Link>
                        <Form action={deleteAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <button
                            type="submit"
                            class="text-slate-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-red-50"
                            preventdefault:click
                            onClick$={async (e, el) => {
                              if (
                                confirm(
                                  `¿Estás seguro de eliminar este chat permanentemente? Se borrarán ${session.messageCount} mensajes.`,
                                )
                              ) {
                                (el.closest('form') as HTMLFormElement).requestSubmit();
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <td colSpan={4} class="px-6 py-20 text-center text-slate-400 bg-slate-50/50">
                        <div class="flex flex-col items-center gap-3">
                          <div class="text-4xl opacity-30">💬</div>
                          <p class="font-bold uppercase tracking-widest text-xs">No hay chats registrados aún</p>
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

      {activeTab.value === 'config' && (
        <div class="max-w-4xl mx-auto w-full space-y-6">
          {action.value?.success && (
            <div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              ✅ Ajustes de IA guardados correctamente.
            </div>
          )}
          {action.value?.failed && (
            <div class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              ❌ {action.value.message}
            </div>
          )}

          <Form action={action} class="space-y-8" preventdefault:submit onSubmit$={handleSubmit}>
            <input type="hidden" name="aiAvatarUrl" value={avatarUrl.value} />
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div class="bg-slate-950 px-8 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-emerald-400 flex items-center gap-2 tracking-wide">
                    <span>🤖</span> AI Chatbot "GardenClubFutbol"
                  </h2>
                  <p class="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
                    Configuración y personalidad del asistente virtual.
                  </p>
                </div>
                <div class="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                  <input
                    type="checkbox"
                    id="aiEnabled"
                    name="aiEnabled"
                    checked={s.aiEnabled ?? true}
                    class="w-5 h-5 rounded text-emerald-500 border-slate-700 focus:ring-emerald-400 transition cursor-pointer bg-slate-800"
                  />
                  <label for="aiEnabled" class="text-xs font-bold text-white uppercase tracking-widest cursor-pointer select-none">
                    Activado
                  </label>
                </div>
              </div>

              <div class="p-8 space-y-6">
                <div class="flex flex-col md:flex-row gap-6">
                  <div class="shrink-0 space-y-2 flex flex-col items-center">
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Avatar del Chatbot</label>
                    <div class="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                      {previewUrl.value || avatarUrl.value ? (
                        <>
                          <img
                            src={previewUrl.value || avatarUrl.value}
                            alt="Avatar IA"
                            width={96}
                            height={96}
                            class="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick$={() => {
                              avatarUrl.value = '';
                              previewUrl.value = null;
                            }}
                            class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"
                            title="Eliminar avatar"
                          >
                            <LuTrash2 class="w-6 h-6" />
                          </button>
                        </>
                      ) : (
                        <LuImage class="w-8 h-8 text-slate-300" />
                      )}
                      {isCompressing.value && (
                        <div class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                          <div class="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div class="relative mt-2">
                      <input
                        type="file"
                        name="image"
                        accept="image/*"
                        onChange$={handleFileChange}
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isCompressing.value}
                      />
                      <button
                        type="button"
                        class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-medium transition-colors"
                      >
                        {previewUrl.value || avatarUrl.value ? 'Cambiar foto' : 'Subir foto'}
                      </button>
                    </div>
                  </div>

                  <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label for="aiTone" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Tono y Personalidad
                      </label>
                      <input
                        type="text"
                        id="aiTone"
                        name="aiTone"
                        value={s.aiTone || ''}
                        placeholder="Ej: Amigable, oficial y con pasión..."
                        class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none"
                      />
                      <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">Define cómo se expresa el chatbot.</p>
                    </div>

                    <div>
                      <label for="whatsappNumber" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        WhatsApp de Contacto
                      </label>
                      <input
                        type="text"
                        id="whatsappNumber"
                        name="whatsappNumber"
                        value={s.whatsappNumber || ''}
                        placeholder="Ej: 54911..."
                        class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none"
                      />
                      <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">Número internacional sin el signo +.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label for="aiInstructions" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Instrucciones
                  </label>
                  <textarea
                    id="aiInstructions"
                    name="aiInstructions"
                    rows={4}
                    style={{ fieldSizing: 'content' }}
                    placeholder="Ingresa las instrucciones base del modelo..."
                    class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none resize-none"
                  >
                    {s.aiInstructions || ''}
                  </textarea>
                  <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">
                    Instrucciones y reglas de comportamiento fundamentales.
                  </p>
                </div>

                <div>
                  <label for="aiKnowledge" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Conocimiento del Club
                  </label>
                  <textarea
                    id="aiKnowledge"
                    name="aiKnowledge"
                    rows={4}
                    style={{ fieldSizing: 'content' }}
                    placeholder="Ingresa reglas extra para la IA..."
                    class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none resize-none"
                  >
                    {s.aiKnowledge || ''}
                  </textarea>
                  <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">
                    Información clave que la IA usará como memoria obligatoria.
                  </p>
                </div>

                <div>
                  <label for="aiInitialGreeting" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Saludo Inicial
                  </label>
                  <textarea
                    id="aiInitialGreeting"
                    name="aiInitialGreeting"
                    rows={2}
                    style={{ fieldSizing: 'content' }}
                    placeholder="Hola! Soy el Asistente de GardenClubFutbol..."
                    class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none resize-none"
                  >
                    {s.aiInitialGreeting || ''}
                  </textarea>
                  <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">
                    Mensaje inicial o primer frase que usará el chatbot.
                  </p>
                </div>

                <div>
                  <label for="aiCallToAction" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Llamado a la Acción (CTA)
                  </label>
                  <textarea
                    id="aiCallToAction"
                    name="aiCallToAction"
                    rows={2}
                    style={{ fieldSizing: 'content' }}
                    placeholder="Para más info, escribinos a nuestro WhatsApp:"
                    class="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none resize-none"
                  >
                    {s.aiCallToAction || ''}
                  </textarea>
                  <p class="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wide">
                    Texto de cierre que la IA agregará al final de sus respuestas importantes.
                  </p>
                </div>
              </div>
            </div>

            <div class="flex justify-end pt-4">
              <button
                type="submit"
                disabled={action.isRunning}
                class="bg-emerald-500 text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-emerald-600 transition shadow-md inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
              >
                {action.isRunning || isCompressing.value ? (
                  <>
                    <svg class="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {isCompressing.value ? 'Optimizando...' : 'Guardando...'}
                  </>
                ) : (
                  'Guardar Configuración IA'
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
  title: 'Asistente IA | Admin | GardenClubFutbol',
};
