import { component$, useStore, $, useVisibleTask$, useSignal, useOnWindow } from '@builder.io/qwik';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const Chatbot = component$((props: { avatarUrl?: string }) => {
  const state = useStore({
    isOpen: false,
    isLoading: false,
    messages: [
      {
        role: 'assistant',
        content: '¡Hola! Soy el asistente virtual de SportGarden. ¿En qué te puedo ayudar hoy?',
      },
    ] as Message[],
    sessionId: '',
  });

  const inputValue = useSignal('');
  const messagesContainerRef = useSignal<HTMLDivElement>();

  useVisibleTask$(() => {
    let sId = sessionStorage.getItem('chatbot_session_id');
    if (!sId) {
      sId = 'sess-' + Date.now().toString() + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('chatbot_session_id', sId);
    }
    state.sessionId = sId;
  });

  // Scroll to bottom when messages update
  useVisibleTask$(({ track }) => {
    track(() => state.messages.length);
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  });

  const sendMessage = $(async () => {
    if (!inputValue.value.trim() || state.isLoading) return;

    const userMsg = inputValue.value.trim();
    inputValue.value = '';

    state.messages.push({ role: 'user', content: userMsg });
    state.isLoading = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.messages.slice(-6),
          sessionId: state.sessionId,
        }),
      });

      if (!response.ok) throw new Error('Error en la conexión');

      const data = await response.json();

      if (data.reply) {
        state.messages.push(data.reply);
      } else {
        state.messages.push({
          role: 'assistant',
          content: 'Ocurrió un error al procesar tu solicitud, intenta nuevamente.',
        });
      }
    } catch (error) {
      console.error('Error de red en chat:', error);
      state.messages.push({
        role: 'assistant',
        content: 'Lo lamento, no pude contactar al servidor. Revisa tu conexión o intenta más tarde.',
      });
    } finally {
      state.isLoading = false;
    }
  });

  const bottomPos = "bottom-[6.5rem]";

  return (
    <>
      {!state.isOpen && (
        <span
          class={[
            "fixed z-40 w-16 h-16 rounded-full bg-emerald-500 animate-ping opacity-60 pointer-events-none transition-all duration-300 right-6",
            bottomPos
          ]}
        ></span>
      )}
      <button
        onClick$={() => (state.isOpen = !state.isOpen)}
        class={[
          "fixed z-50 rounded-full shadow-2xl shadow-emerald-500/20 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center border-2 cursor-pointer right-6 overflow-hidden",
          bottomPos,
          state.isOpen
            ? "bg-slate-950 text-white w-14 h-14 border-slate-800 p-3"
            : "bg-emerald-500 text-slate-950 w-16 h-16 border-emerald-400 " + (props.avatarUrl ? "p-0 border-0" : "p-3")
        ]}
        aria-label="Abrir asistente virtual"
      >
        {state.isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : props.avatarUrl ? (
          <img src={props.avatarUrl} alt="Chatbot" class="w-full h-full object-cover" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-10 h-10">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0-4.43 3.65-8.08 8.08-8.08h3.33c4.43 0 8.08 3.65 8.08 8.08s-3.65 8.08-8.08 8.08H7.5A5.25 5.25 0 012.25 15.6zm10.74-2.5h.01M9.75 10.25h.01M14.25 10.25h.01" />
          </svg>
        )}
      </button>

      {state.isOpen && (
        <div
          class={[
            "fixed z-[100] right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-85 h-[32rem] max-h-[80vh] bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-300",
            bottomPos === "bottom-[6.5rem]" ? "bottom-[11.5rem]" : "bottom-[13rem] sm:bottom-[14rem]"
          ]}
        >

          {/* Header */}
          <div class="bg-slate-950 text-white p-5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="relative">
                {props.avatarUrl ? (
                  <img src={props.avatarUrl} alt="Asistente IA" class="w-10 h-10 rounded-full object-cover border-2 border-emerald-500" />
                ) : (
                  <div class="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 font-black text-lg">
                    SG
                  </div>
                )}
                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h3 class="font-black text-base tracking-widest uppercase text-emerald-400">Asistente IA</h3>
                <p class="text-[10px] text-slate-400 font-bold tracking-widest uppercase">En línea</p>
              </div>
            </div>
            <button onClick$={() => state.isOpen = false} class="text-slate-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            class="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col bg-slate-50/50"
          >
            {state.messages.map((msg, i) => (
              <div
                key={i}
                class={["flex w-full", msg.role === 'user' ? "justify-end" : "justify-start"]}
              >
                <div
                  class={[
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-emerald-600 text-white rounded-br-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                  ]}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {state.isLoading && (
              <div class="flex justify-start">
                <div class="bg-white border border-slate-200 text-slate-400 rounded-2xl rounded-bl-none px-4 py-3 text-sm shadow-sm flex items-center gap-1.5">
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div class="p-4 bg-white border-t border-slate-100">
            <form
              preventdefault:submit
              onSubmit$={sendMessage}
              class="flex gap-2"
            >
              <input
                type="text"
                bind:value={inputValue}
                placeholder="Escribe tu consulta..."
                class="flex-1 bg-slate-100 text-sm rounded-xl px-4 py-3 border border-transparent focus:outline-none focus:bg-white focus:border-emerald-500 transition-all"
                disabled={state.isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.value.trim() || state.isLoading}
                class="bg-slate-950 text-emerald-400 p-3 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
});
