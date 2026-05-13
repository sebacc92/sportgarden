import { component$ } from '@builder.io/qwik';
import { routeLoader$, Link, type DocumentHead } from '@builder.io/qwik-city';
import { getDB } from '~/db';
import { chatSessions, chatMessages } from '~/db/schema';
import { eq, asc } from 'drizzle-orm';

export const useChatDetailLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, requestEvent.params.id)).limit(1);
  if (!session) return requestEvent.fail(404, { message: 'Sesión no encontrada' });

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, requestEvent.params.id))
    .orderBy(asc(chatMessages.createdAt));
    
  return { session, messages };
});

export default component$(() => {
  const detail = useChatDetailLoader();

  if (detail.value.failed) return <div class="p-20 text-center font-bold text-red-500">{detail.value.message}</div>;

  const { session, messages } = detail.value;

  return (
    <div class="max-w-4xl mx-auto space-y-6 pb-20">
      <div class="flex items-center justify-between mb-8">
        <div>
          <nav class="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">
            <Link href="/admin/chats" class="hover:text-emerald-500 transition-colors">Auditoría</Link>
            <span>/</span>
            <span class="text-slate-900">Detalle de Sesión</span>
          </nav>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">
            Conversación IA
          </h1>
          <p class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {session.id}</p>
        </div>
        <Link 
          href="/admin/chats" 
          class="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
        >
          &larr; Volver
        </Link>
      </div>

      <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[70vh]">
        {/* Chat Stats Header */}
        <div class="bg-slate-950 px-8 py-4 border-b border-white/10 flex items-center justify-between text-white">
          <div class="flex gap-6">
            <div>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Iniciado</p>
              <p class="text-xs font-bold">{session.createdAt ? new Date(session.createdAt).toLocaleString('es-AR') : '—'}</p>
            </div>
            <div>
              <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Última Actividad</p>
              <p class="text-xs font-bold">{session.lastActive ? new Date(session.lastActive).toLocaleString('es-AR') : '—'}</p>
            </div>
          </div>
          <div class="bg-emerald-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            {messages.length} mensajes
          </div>
        </div>

        {/* Message Log */}
        <div class="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              class={["flex flex-col gap-1.5", msg.role === 'user' ? "items-end" : "items-start"]}
            >
              <div class="flex items-center gap-2 mb-1 px-1">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {msg.role === 'user' ? '👤 Usuario' : '🤖 Asistente GardenClubFutbol'}
                </span>
                <span class="text-[9px] text-slate-300 font-bold">{new Date(msg.createdAt).toLocaleTimeString('es-AR')}</span>
              </div>
              <div 
                class={[
                  "max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm leading-relaxed border",
                  msg.role === 'user' 
                    ? "bg-slate-950 text-white border-transparent rounded-tr-none" 
                    : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
                ]}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
             <div class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-3">
               <div class="text-5xl">📭</div>
               <p class="font-bold uppercase tracking-widest text-xs">No hay mensajes registrados</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Detalle de Chat | Admin | GardenClubFutbol',
};
