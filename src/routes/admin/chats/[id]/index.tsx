import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { chatSessions, chatMessages } from "~/db/schema";

export const useChatDetailLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: sessionList, error: sessErr } = await db
    .from(chatSessions)
    .select("*")
    .eq("id", requestEvent.params.id)
    .limit(1);

  if (sessErr) {
    return requestEvent.fail(500, { message: "Error de base de datos" });
  }

  const session = camelize<any>(sessionList?.[0]);

  if (!session)
    return requestEvent.fail(404, { message: "Sesión no encontrada" });

  const { data: messagesList, error: msgErr } = await db
    .from(chatMessages)
    .select("*")
    .eq("session_id", requestEvent.params.id)
    .order("created_at", { ascending: true });

  if (msgErr) {
    return requestEvent.fail(500, { message: "Error de base de datos" });
  }

  const messages = camelize<any[]>(messagesList || []);

  return { session, messages };
});

export default component$(() => {
  const detail = useChatDetailLoader();

  if (detail.value.failed)
    return (
      <div class="p-20 text-center font-bold text-red-500">
        {detail.value.message}
      </div>
    );

  const { session, messages } = detail.value;

  return (
    <div class="mx-auto max-w-4xl space-y-6 pb-20">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <nav class="mb-2 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
            <Link
              href="/admin/ia/"
              class="transition-colors hover:text-emerald-500"
            >
              Asistente IA
            </Link>
            <span>/</span>
            <span class="text-slate-900">Detalle de Sesión</span>
          </nav>
          <h1 class="text-3xl font-black tracking-tight text-slate-900">
            Conversación IA
          </h1>
          <p class="mt-1 text-xs font-bold tracking-widest text-slate-400 uppercase">
            ID: {session.id}
          </p>
        </div>
        <Link
          href="/admin/ia/"
          class="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold tracking-widest text-slate-700 uppercase shadow-sm transition-all hover:bg-slate-50"
        >
          &larr; Volver
        </Link>
      </div>

      <div class="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Chat Stats Header */}
        <div class="flex items-center justify-between border-b border-white/10 bg-slate-950 px-8 py-4 text-white">
          <div class="flex gap-6">
            <div>
              <p class="text-[9px] font-bold tracking-tighter text-slate-400 uppercase">
                Iniciado
              </p>
              <p class="text-xs font-bold">
                {session.createdAt
                  ? new Date(session.createdAt).toLocaleString("es-AR")
                  : "—"}
              </p>
            </div>
            <div>
              <p class="text-[9px] font-bold tracking-tighter text-slate-400 uppercase">
                Última Actividad
              </p>
              <p class="text-xs font-bold">
                {session.lastActive
                  ? new Date(session.lastActive).toLocaleString("es-AR")
                  : "—"}
              </p>
            </div>
          </div>
          <div class="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase">
            {messages.length} mensajes
          </div>
        </div>

        {/* Message Log */}
        <div class="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-8">
          {messages.map((msg) => (
            <div
              key={msg.id}
              class={[
                "flex flex-col gap-1.5",
                msg.role === "user" ? "items-end" : "items-start",
              ]}
            >
              <div class="mb-1 flex items-center gap-2 px-1">
                <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  {msg.role === "user"
                    ? "👤 Usuario"
                    : "🤖 Asistente GardenClubFutbol"}
                </span>
                <span class="text-[9px] font-bold text-slate-300">
                  {new Date(msg.createdAt).toLocaleTimeString("es-AR")}
                </span>
              </div>
              <div
                class={[
                  "max-w-[85%] rounded-2xl border px-5 py-3.5 text-sm leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "rounded-tr-none border-transparent bg-slate-950 text-white"
                    : "rounded-tl-none border-slate-200 bg-white text-slate-800",
                ]}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div class="flex h-full flex-col items-center justify-center space-y-3 text-slate-400 opacity-50">
              <div class="text-5xl">📭</div>
              <p class="text-xs font-bold tracking-widest uppercase">
                No hay mensajes registrados
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Detalle de Chat | Admin | GardenClubFutbol",
};
