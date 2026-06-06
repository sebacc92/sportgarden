import { routeLoader$, server$, type RequestEventBase } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { pitches, bookings, instagramPosts, siteSettings, pitchOverlaps } from "~/db/schema";
import { MOCK_INSTAGRAM_POSTS } from "~/components/ui/social-feed";

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: pitchesData, error: pitchesErr } = await db
    .from(pitches)
    .select(`
      *,
      pricingRules:pitch_pricing_rules(*)
    `)
    .eq("is_active", true);

  if (pitchesErr) {
    throw new Error(pitchesErr.message);
  }
  return camelize<any[]>(pitchesData);
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
    const { data: postsData, error: postsErr } = await db
      .from(instagramPosts)
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(6);

    if (postsErr) {
      throw new Error(postsErr.message);
    }
    const posts = camelize<any[]>(postsData);

    if (posts && posts.length > 0) {
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
  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    throw new Error(settingsErr.message);
  }
  const settings = camelize<any>(settingsData);

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
  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("gallery_images")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    throw new Error(settingsErr.message);
  }
  const settings = camelize<any>(settingsData);
  return (settings?.galleryImages as string[] | null) ?? [];
});

export const getDailyBookings = server$(async function (this: RequestEventBase, pitchId: string, dateStr: string) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59`);

  // Get related pitch IDs (bidirectional)
  const { data: overlapsData, error: overlapErr } = await db
    .from(pitchOverlaps)
    .select("*")
    .or(`pitch_id.eq.${pitchId},overlap_pitch_id.eq.${pitchId}`);

  if (overlapErr) {
    throw new Error(overlapErr.message);
  }
  const overlaps = camelize<any[]>(overlapsData);
  const relatedIds = [pitchId, ...overlaps.map((o: any) => o.pitchId === pitchId ? o.overlapPitchId : o.pitchId)];

  const { data: dailyBookingsData, error: bookingsErr } = await db
    .from(bookings)
    .select("start_time, end_time")
    .in("pitch_id", relatedIds)
    .gte("start_time", startOfDay.toISOString())
    .lt("start_time", endOfDay.toISOString())
    .in("status", ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "COMPLETED"])
    .order("start_time", { ascending: true });

  if (bookingsErr) {
    throw new Error(bookingsErr.message);
  }
  const dailyBookings = camelize<any[]>(dailyBookingsData);

  return dailyBookings.map((b) => ({
    startTime: new Date(b.startTime).toISOString(),
    endTime: new Date(b.endTime).toISOString(),
  }));
});
