import { routeLoader$, server$, type RequestEventBase } from "@builder.io/qwik-city";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches, bookings, instagramPosts, siteSettings } from "~/db/schema";
import { MOCK_INSTAGRAM_POSTS } from "~/components/ui/social-feed";

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.select().from(pitches).where(eq(pitches.isActive, true));
});

export const useUserLoader = routeLoader$((requestEvent) => {
  return requestEvent.sharedMap.get("user") as { userId: string; role: string } | undefined;
});

export const useInstagramFeed = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  try {
    const posts = await db.query.instagramPosts.findMany({
      orderBy: [desc(instagramPosts.timestamp)],
      limit: 6,
    });

    if (posts.length > 0) {
      return posts.map((p) => ({
        id: p.id,
        imageUrl: p.mediaUrl,
        link: p.permalink,
        caption: p.caption || undefined,
      }));
    }

    return MOCK_INSTAGRAM_POSTS;
  } catch (error) {
    console.error("Error cargando feed de instagram desde DB", error);
    return MOCK_INSTAGRAM_POSTS;
  }
});

export const useAISettingsLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return {
    ...settings,
    paymentMethods: (settings?.paymentMethods || []) as { id: string; name: string; isActive: boolean }[],
    extraServices: (settings?.extraServices || []) as any[],
    operatingHours: (settings?.operatingHours || []) as any[],
    services: (settings?.services || []) as string[],
  };
});

export const useGalleryLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db
    .select({ galleryImages: siteSettings.galleryImages })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  return (settings?.galleryImages as string[] | null) ?? [];
});

export const getDailyBookings = server$(async function (this: RequestEventBase, pitchId: string, dateStr: string) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59`);

  const dailyBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.pitchId, pitchId),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"]),
    ),
    columns: {
      startTime: true,
      endTime: true,
    },
    orderBy: (bookings, { asc }) => [asc(bookings.startTime)],
  });

  return dailyBookings.map((b) => ({
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
  }));
});
