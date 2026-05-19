import { type RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { siteSettings, chatSessions, chatMessages, pitches } from "~/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    const { request, env, json } = requestEvent;

    const db = getDB(requestEvent);
    const [settings] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    if (settings && !settings.aiEnabled) {
      json(403, {
        error: "El Chatbot se encuentra deshabilitado actualmente.",
      });
      return;
    }

    const body = await request.json();
    if (!body || !body.messages) {
      json(400, { error: "Faltan mensajes en la petición." });
      return;
    }

    const { messages, sessionId } = body;

    if (sessionId) {
      // Registrar sesión y mensajes en DB
      try {
        await db
          .insert(chatSessions)
          .values({
            id: sessionId,
            createdAt: new Date(),
            lastActive: new Date(),
          })
          .onConflictDoUpdate({
            target: chatSessions.id,
            set: { lastActive: new Date() },
          });

        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === "user") {
          await db.insert(chatMessages).values({
            id:
              "msg-" + Date.now().toString() + Math.floor(Math.random() * 1000),
            sessionId: sessionId,
            role: "user",
            content: lastUserMessage.content,
            createdAt: new Date(),
          });
        }
      } catch (dbErr) {
        console.error("Error guardando en BD (silenciado)", dbErr);
      }
    }

    // Fetch context data: Canchas activas
    const activePitches = await db
      .select()
      .from(pitches)
      .where(eq(pitches.isActive, true));

    const formatPitches = (p: typeof activePitches) =>
      p
        .map(
          (x) =>
            `- ${x.name} (Fútbol ${x.type.replace("F", "")}): ${x.isCovered ? "Techada" : "Descubierta"}. Precio base: $${x.pricePerHour}/hora. ${x.peakHourStart ? `(Desde ${x.peakHourStart}hs tarifa nocturna: $${x.peakPricePerHour}/h)` : ""}`,
        )
        .join("\n");

    const formatOperatingHours = (hoursJson: any) => {
      try {
        if (!hoursJson) return "No configurado.";
        const hours = typeof hoursJson === "string" ? JSON.parse(hoursJson) : hoursJson;
        if (!Array.isArray(hours)) return "No configurado.";
        const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        return hours
          .map((h: any) => `- ${days[h.day]}: ${h.isOpen ? `${h.openTime}hs a ${h.closeTime}hs` : "Cerrado"}`)
          .join("\n");
      } catch {
        return "No configurado.";
      }
    };

    const formatSchoolCategories = (categoriesJson: any) => {
      try {
        if (!categoriesJson) return "No configurado actualmente.";
        const categories = typeof categoriesJson === "string" ? JSON.parse(categoriesJson) : categoriesJson;
        if (!Array.isArray(categories)) return "No configurado actualmente.";
        return categories.map((c: any) => `- ${c.name} ${c.teacher ? `(Profesor/Entrenador: ${c.teacher})` : ""}`).join("\n");
      } catch {
        return "No configurado actualmente.";
      }
    };

    const formatServices = (servicesJson: any) => {
      try {
        if (!servicesJson) return "No configurado.";
        const list = typeof servicesJson === "string" ? JSON.parse(servicesJson) : servicesJson;
        if (!Array.isArray(list)) return "No configurado.";
        return list.map((s: string) => `- ${s}`).join("\n");
      } catch {
        return "No configurado.";
      }
    };

    const formatExtraServices = (extrasJson: any) => {
      try {
        if (!extrasJson) return "Ninguno.";
        const list = typeof extrasJson === "string" ? JSON.parse(extrasJson) : extrasJson;
        if (!Array.isArray(list)) return "Ninguno.";
        return list.map((e: any) => `- ${e.name}: $${e.price}`).join("\n");
      } catch {
        return "Ninguno.";
      }
    };

    const formatPaymentMethods = (methodsJson: any) => {
      try {
        if (!methodsJson) return "No configurado.";
        const list = typeof methodsJson === "string" ? JSON.parse(methodsJson) : methodsJson;
        if (!Array.isArray(list)) return "No configurado.";
        return list.filter((m: any) => m.isActive).map((m: any) => `- ${m.name}`).join("\n");
      } catch {
        return "No configurado.";
      }
    };

    // System prompt
    const systemPrompt = `${settings?.aiInitialGreeting || "Hola! Soy el Asistente de GardenClubFutbol, ¿en qué te puedo ayudar hoy?"}

INFORMACIÓN GENERAL DEL CLUB (DESDE BASE DE DATOS):
- Nombre del Complejo: ${settings?.clubName || "Sport Garden / GardenClubFutbol"}
- Ubicación / Dirección: ${settings?.clubAddress || "No especificada. Consultar vía WhatsApp."}
- Teléfono de Contacto: ${settings?.clubPhone || "No especificado."}
- WhatsApp de Contacto: ${settings?.whatsappNumber || "No especificado."}

HORARIOS DE ATENCIÓN:
${formatOperatingHours(settings?.operatingHours)}

SERVICIOS GENERALES:
${formatServices(settings?.services)}

SERVICIOS ADICIONALES:
${formatExtraServices(settings?.extraServices)}

ESCUELITAS Y CATEGORÍAS DISPONIBLES:
${formatSchoolCategories(settings?.schoolCategories)}

MÉTODOS DE PAGO ACEPTADOS:
${formatPaymentMethods(settings?.paymentMethods)}
${settings?.bankAlias ? `- Alias Bancario para Transferencias: ${settings.bankAlias}` : ""}

DATOS EN TIEMPO REAL (CANCHAS DISPONIBLES EN EL COMPLEJO):
${activePitches.length > 0 ? formatPitches(activePitches) : "No hay información de canchas en este momento."}

CONOCIMIENTO ADICIONAL DEL CLUB:
${settings?.aiKnowledge || "- Identidad: Somos GardenClubFutbol. Nuestro foco es brindar las mejores canchas de césped sintético e iluminación LED de la zona."}

INSTRUCCIONES Y REGLAS DE COMPORTAMIENTO PARA LA IA:
- Tono: ${settings?.aiTone || "Amigable, apasionado por el fútbol, respetuoso y servicial"}.
- WhatsApp de Contacto: ${settings?.whatsappNumber || "No especificado"}.
- NUNCA compartas balances, estado de caja, ingresos, egresos ni información de transacciones internas con los usuarios generales. Usa el sentido común.
- Mantén tus respuestas claras, profesionales y enfocadas en la experiencia del cliente y la pasión por el fútbol.
- Si te consultan por disponibilidad exacta o reservas específicas que no figuran aquí, invítalos cordialmente a usar el sistema interactivo de reservas de nuestra web o a contactarnos por WhatsApp: ${settings?.whatsappNumber || "5491112345678"}.
${settings?.aiInstructions || "1. TRATO NEUTRO E INCLUSIVO.\n2. CERO ALUCINACIONES: Si preguntan disponibilidad exacta para una fecha, indícales que usen el sistema de reservas de la web o el WhatsApp."}

LLAMADO A LA ACCIÓN:
${settings?.aiCallToAction || "Para reservar tu turno, usá nuestra web o escribinos al WhatsApp:"} ${settings?.whatsappNumber || "5491112345678"}`;

    const openaiApiKey = env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      json(500, { error: "API Key de OpenAI no configurada." });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          })),
        ],
        max_tokens: 400,
        temperature: 0.5,
      });

      const replyText =
        response.choices[0]?.message?.content ||
        "Lo siento. Tuve un problema para procesar tu mensaje. ¿Podrías intentar de nuevo?";

      if (sessionId) {
        try {
          await db.insert(chatMessages).values({
            id:
              "msg-" + Date.now().toString() + Math.floor(Math.random() * 1000),
            sessionId: sessionId,
            role: "assistant",
            content: replyText,
            createdAt: new Date(),
          });
        } catch (dbErr) {
          console.error("Error guardando en BD (silenciado)", dbErr);
        }
      }

      json(200, { reply: { role: "assistant", content: replyText } });
    } catch (openaiErr: any) {
      console.error("OpenAI Error:", openaiErr);
      json(500, { error: "Error al contactar con el servicio de IA." });
    }
  } catch (err: any) {
    console.error("Chatbot error:", err);
    requestEvent.json(500, { error: "Error inesperado del servidor." });
  }
};
