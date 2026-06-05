import { routeLoader$, server$, type RequestEventBase } from "@builder.io/qwik-city";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches, bookings, instagramPosts, siteSettings, pitchOverlaps } from "~/db/schema";
import { MOCK_INSTAGRAM_POSTS } from "~/components/ui/social-feed";

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.query.pitches.findMany({
    where: eq(pitches.isActive, true),
    with: { pricingRules: true }
  });
});

export const useUserLoader = routeLoader$((requestEvent) => {
  return requestEvent.sharedMap.get("user") as {
    userId: string;
    role: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | undefined;
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
    schoolCategories: (settings?.schoolCategories || []) as { id: string; name: string; teacher: string; monthlyFee: number; schedules?: { day: number; startTime: string; endTime: string }[] }[],
    holidays: (settings?.holidays || []) as { date: string; name: string }[],
    reels: (settings?.reels || []) as { id: string; videoUrl: string; posterUrl: string; caption?: string }[],
    landingTexts: (settings?.landingTexts || null) as any,
    heroSlides: (settings?.heroSlides || null) as any[],
    promoPopup: (settings?.promoPopup || null) as any,
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

  // Get related pitch IDs (bidirectional)
  const { or } = await import("drizzle-orm");
  const overlaps = await db.select().from(pitchOverlaps).where(
    or(
      eq(pitchOverlaps.pitchId, pitchId),
      eq(pitchOverlaps.overlapPitchId, pitchId)
    )
  );
  const relatedIds = [pitchId, ...overlaps.map((o: any) => o.pitchId === pitchId ? o.overlapPitchId : o.pitchId)];

  const dailyBookings = await db.query.bookings.findMany({
    where: and(
      inArray(bookings.pitchId, relatedIds),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "COMPLETED"]),
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
