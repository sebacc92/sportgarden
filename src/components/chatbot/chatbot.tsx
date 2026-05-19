import {
  component$,
  useStore,
  $,
  useVisibleTask$,
  useSignal,
} from "@builder.io/qwik";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export const Chatbot = component$((props: { avatarUrl?: string }) => {
  const state = useStore({
    isOpen: false,
    isLoading: false,
    messages: [
      {
        role: "assistant",
        content:
          "¡Hola! Soy el asistente virtual de GardenClubFutbol. ¿En qué te puedo ayudar hoy?",
      },
    ] as Message[],
    sessionId: "",
  });

  const inputValue = useSignal("");
  const messagesContainerRef = useSignal<HTMLDivElement>();

  useVisibleTask$(() => {
    let sId = sessionStorage.getItem("chatbot_session_id");
    if (!sId) {
      sId =
        "sess-" +
        Date.now().toString() +
        Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("chatbot_session_id", sId);
    }
    state.sessionId = sId;
  });

  // Scroll to bottom when messages update
  useVisibleTask$(({ track }) => {
    track(() => state.messages.length);
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop =
        messagesContainerRef.value.scrollHeight;
    }
  });

  const sendMessage = $(async () => {
    if (!inputValue.value.trim() || state.isLoading) return;

    const userMsg = inputValue.value.trim();
    inputValue.value = "";

    state.messages.push({ role: "user", content: userMsg });
    state.isLoading = true;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.slice(-6),
          sessionId: state.sessionId,
        }),
      });

      if (!response.ok) throw new Error("Error en la conexión");

      const data = await response.json();

      if (data.reply) {
        state.messages.push(data.reply);
      } else {
        state.messages.push({
          role: "assistant",
          content:
            "Ocurrió un error al procesar tu solicitud, intenta nuevamente.",
        });
      }
    } catch (error) {
      console.error("Error de red en chat:", error);
      state.messages.push({
        role: "assistant",
        content:
          "Lo lamento, no pude contactar al servidor. Revisa tu conexión o intenta más tarde.",
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
            "pointer-events-none fixed right-6 z-40 h-16 w-16 animate-ping rounded-full bg-emerald-500 opacity-60 transition-all duration-300",
            bottomPos,
          ]}
        ></span>
      )}
      <button
        onClick$={() => (state.isOpen = !state.isOpen)}
        class={[
          "fixed right-6 z-50 flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 shadow-2xl shadow-emerald-900/25 transition-all duration-300 hover:scale-105 active:scale-95",
          bottomPos,
          state.isOpen
            ? "h-14 w-14 border-slate-800 bg-slate-950 p-3 text-white"
            : "h-16 w-16 border-emerald-300 bg-emerald-500 text-white " +
              (props.avatarUrl ? "border-0 p-0" : "p-3"),
        ]}
        aria-label="Abrir asistente virtual"
      >
        {state.isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-6 w-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : props.avatarUrl ? (
          <img
            src={props.avatarUrl}
            alt="Chatbot"
            class="h-full w-full object-cover"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-10 w-10"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 12.76c0-4.43 3.65-8.08 8.08-8.08h3.33c4.43 0 8.08 3.65 8.08 8.08s-3.65 8.08-8.08 8.08H7.5A5.25 5.25 0 012.25 15.6zm10.74-2.5h.01M9.75 10.25h.01M14.25 10.25h.01"
            />
          </svg>
        )}
      </button>

      {state.isOpen && (
        <div
          class={[
            "animate-in slide-in-from-bottom-5 fade-in fixed right-4 z-[100] flex h-[32rem] max-h-[80vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-300 sm:right-6 sm:w-85",
            bottomPos === "bottom-[6.5rem]"
              ? "bottom-[11.5rem]"
              : "bottom-[13rem] sm:bottom-[14rem]",
          ]}
        >
          {/* Header */}
          <div class="flex items-center justify-between bg-slate-950 p-5 text-white">
            <div class="flex items-center gap-3">
              <div class="relative">
                {props.avatarUrl ? (
                  <img
                    src={props.avatarUrl}
                    alt="Asistente IA"
                    class="h-10 w-10 rounded-full border-2 border-emerald-500 object-cover"
                  />
                ) : (
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white">
                    GC
                  </div>
                )}
                <div class="absolute right-0 bottom-0 h-3 w-3 animate-pulse rounded-full border-2 border-slate-950 bg-emerald-400"></div>
              </div>
              <div>
                <h3 class="text-base font-black tracking-widest text-emerald-400 uppercase">
                  Asistente IA
                </h3>
                <p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  En línea
                </p>
              </div>
            </div>
            <button
              onClick$={() => (state.isOpen = false)}
              class="text-slate-400 transition-colors hover:text-white"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            class="flex flex-1 flex-col space-y-4 overflow-y-auto bg-slate-50/50 p-4"
          >
            {state.messages.map((msg, i) => (
              <div
                key={i}
                class={[
                  "flex w-full",
                  msg.role === "user" ? "justify-end" : "justify-start",
                ]}
              >
                <div
                  class={[
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "rounded-br-none bg-emerald-600 text-white"
                      : "rounded-bl-none border border-slate-200 bg-white text-slate-800",
                  ]}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {state.isLoading && (
              <div class="flex justify-start">
                <div class="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500"></div>
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]"></div>
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div class="border-t border-slate-100 bg-white p-4">
            <form
              preventdefault:submit
              onSubmit$={sendMessage}
              class="flex gap-2"
            >
              <input
                type="text"
                bind:value={inputValue}
                placeholder="Escribe tu consulta..."
                class="flex-1 rounded-xl border border-transparent bg-slate-100 px-4 py-3 text-sm transition-all focus:border-emerald-500 focus:bg-white focus:outline-none"
                disabled={state.isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.value.trim() || state.isLoading}
                class="flex items-center justify-center rounded-xl bg-emerald-500 p-3 text-white transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="h-5 w-5"
                >
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
