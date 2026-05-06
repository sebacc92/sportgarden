import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, Link, type DocumentHead } from '@builder.io/qwik-city';
import { getDB } from '~/db';
import { chatSessions, chatMessages } from '~/db/schema';
import { desc, count, eq } from 'drizzle-orm';

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

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const deleteAction = useDeleteChatAction();

  return (
    <div class="max-w-6xl mx-auto space-y-6 pb-20">
      <div class="mb-8">
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">
          Auditoría de IA
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Revisa las conversaciones que los usuarios mantienen con el Asistente de SportGarden.
        </p>
      </div>

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
                <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Inicio</th>
                <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Última Actividad</th>
                <th scope="col" class="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interacción</th>
                <th scope="col" class="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acciones</th>
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
                    <span class={["inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", 
                      session.messageCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"]}>
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
                    <Form 
                      action={deleteAction} 
                    >
                      <input type="hidden" name="id" value={session.id} />
                      <button
                        type="submit"
                        class="text-slate-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-red-50"
                        preventdefault:click
                        onClick$={async (e, el) => {
                          if (confirm(`¿Estás seguro de eliminar este chat permanentemente? Se borrarán ${session.messageCount} mensajes.`)) {
                           (el.closest('form') as HTMLFormElement).requestSubmit();
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
  );
});

export const head: DocumentHead = {
  title: 'Auditoría de IA | Admin | SportGarden',
};
