import { type RequestHandler } from '@builder.io/qwik-city';
import { getDB } from '~/db';
import { siteSettings, chatSessions, chatMessages, pitches } from '~/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    const { request, env, json } = requestEvent;

    const db = getDB(requestEvent);
    const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);

    if (settings && !settings.aiEnabled) {
      json(403, { error: 'El Chatbot se encuentra deshabilitado actualmente.' });
      return;
    }

    const body = await request.json();
    if (!body || !body.messages) {
      json(400, { error: 'Faltan mensajes en la petición.' });
      return;
    }

    const { messages, sessionId } = body;

    if (sessionId) {
      // Registrar sesión y mensajes en DB
      try {
        await db.insert(chatSessions).values({
          id: sessionId,
          createdAt: new Date(),
          lastActive: new Date()
        }).onConflictDoUpdate({
          target: chatSessions.id,
          set: { lastActive: new Date() }
        });

        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
          await db.insert(chatMessages).values({
            id: 'msg-' + Date.now().toString() + Math.floor(Math.random() * 1000),
            sessionId: sessionId,
            role: 'user',
            content: lastUserMessage.content,
            createdAt: new Date()
          });
        }
      } catch (dbErr) {
        console.error('Error guardando en BD (silenciado)', dbErr);
      }
    }

    // Fetch context data: Canchas activas
    const activePitches = await db.select().from(pitches).where(eq(pitches.isActive, true));

    const formatPitches = (p: typeof activePitches) => p.map(x =>
      `- ${x.name} (Fútbol ${x.type.replace('F', '')}): ${x.isCovered ? 'Techada' : 'Descubierta'}. Precio base: $${x.pricePerHour}/hora. ${x.peakHourStart ? `(Desde ${x.peakHourStart}hs tarifa nocturna: $${x.peakPricePerHour}/h)` : ''}`
    ).join('\n');

    // System prompt
    const systemPrompt = `${settings?.aiInitialGreeting || 'Hola! Soy el Asistente de GardenClubFutbol, ¿en qué te puedo ayudar hoy?'}

DATOS EN TIEMPO REAL (CANCHAS DISPONIBLES EN EL COMPLEJO):
${activePitches.length > 0 ? formatPitches(activePitches) : 'No hay información de canchas en este momento.'}

CONOCIMIENTO DEL CLUB:
${settings?.aiKnowledge || '- Identidad: Somos GardenClubFutbol. Nuestro foco es brindar las mejores canchas de césped sintético e iluminación LED de la zona.'}

INSTRUCCIONES Y REGLAS:
- Tono: ${settings?.aiTone || 'Amigable, apasionado por el fútbol, respetuoso y servicial'}.
- WhatsApp de Contacto: ${settings?.whatsappNumber || '5491112345678'}.
${settings?.aiInstructions || '1. TRATO NEUTRO E INCLUSIVO.\n2. CERO ALUCINACIONES: Si preguntan disponibilidad exacta para una fecha, indícales que usen el sistema de reservas de la web o el WhatsApp.'}

LLAMADO A LA ACCIÓN:
${settings?.aiCallToAction || 'Para reservar tu turno, usá nuestra web o escribinos al WhatsApp:'} ${settings?.whatsappNumber || '5491112345678'}`;

    const openaiApiKey = env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      json(500, { error: 'API Key de OpenAI no configurada.' });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
          }))
        ],
        max_tokens: 400,
        temperature: 0.5,
      });

      const replyText = response.choices[0]?.message?.content || 'Lo siento. Tuve un problema para procesar tu mensaje. ¿Podrías intentar de nuevo?';

      if (sessionId) {
        try {
          await db.insert(chatMessages).values({
            id: 'msg-' + Date.now().toString() + Math.floor(Math.random() * 1000),
            sessionId: sessionId,
            role: 'assistant',
            content: replyText,
            createdAt: new Date()
          });
        } catch (dbErr) {
          console.error('Error guardando en BD (silenciado)', dbErr);
        }
      }

      json(200, { reply: { role: 'assistant', content: replyText } });
    } catch (openaiErr: any) {
      console.error('OpenAI Error:', openaiErr);
      json(500, { error: 'Error al contactar con el servicio de IA.' });
    }
  } catch (err: any) {
    console.error('Chatbot error:', err);
    requestEvent.json(500, { error: 'Error inesperado del servidor.' });
  }
};
