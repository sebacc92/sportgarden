import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, type DocumentHead } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { products, orders } from "~/db/schema";
import { StoreSection } from "~/components/home/store-section";
import {
  useGuestBookingAction,
  useUserBookingAction,
  useConfirmarPagoPayway,
} from "./api/bookings/index";
import {
  usePitchesLoader,
  useUserLoader,
  useInstagramFeed,
  useAISettingsLoader,
  useGalleryLoader,
} from "~/lib/home-page/loaders";
import { SocialFeed } from "~/components/ui/social-feed";
import { Chatbot } from "~/components/chatbot/chatbot";
import { WhatsAppButton } from "~/components/ui/whatsapp-button";
import { HomeNavbar } from "~/components/home/home-navbar";
import { HeroSlider } from "~/components/home/hero-slider";
import { HistorySection } from "~/components/home/history-section";
import { PromoPopup } from "~/components/home/promo-popup";
import { PitchesGrid } from "~/components/home/pitches-grid";
import { GallerySection } from "~/components/home/gallery-section";
import { ReelsSection } from "~/components/home/reels-section";
import { ContactSection } from "~/components/home/contact-section";
import { HomeFooter } from "~/components/home/home-footer";
import { HomeBookingModal } from "~/components/home/home-booking-modal";
import { SchoolSection } from "~/components/home/school-section";
import { SectionDivider } from "~/components/home/section-divider";

export { useGuestBookingAction, useUserBookingAction, useConfirmarPagoPayway };
export {
  usePitchesLoader,
  useUserLoader,
  useInstagramFeed,
  useAISettingsLoader,
  useGalleryLoader,
};
export { getDailyBookings } from "~/lib/home-page/loaders";

export const useActiveProducts = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data, error } = await db.from(products).select("*").eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }
  return camelize<any[]>(data || []);
});

export const useCheckoutAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const items = JSON.parse(data.items) as Array<{ productId: string; name: string; price: number; quantity: number }>;

    if (items.length === 0) {
      return requestEvent.fail(400, { message: "El carrito está vacío." });
    }

    try {
      // Validate stock for all products
      const fetchedProducts: any[] = [];
      for (const item of items) {
        const { data: prod, error: prodErr } = await db
          .from(products)
          .select("*")
          .eq("id", item.productId)
          .maybeSingle();

        if (prodErr || !prod) {
          return requestEvent.fail(404, { message: `Producto "${item.name}" no encontrado.` });
        }
        if (prod.stock < item.quantity) {
          return requestEvent.fail(400, { message: `Stock insuficiente para "${item.name}". Stock disponible: ${prod.stock}` });
        }
        fetchedProducts.push({ prod, item });
      }

      // Deduct stock
      for (const { prod, item } of fetchedProducts) {
        const newStock = prod.stock - item.quantity;
        const { error: updateErr } = await db
          .from(products)
          .update({ stock: newStock })
          .eq("id", item.productId);

        if (updateErr) {
          throw new Error(updateErr.message);
        }
      }

      // Save order
      const { error: insertErr } = await db.from(orders).insert({
        id: orderId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        totalAmount: Number(data.totalAmount),
        status: "PENDING",
        items: items,
      });

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      return { success: true, orderId };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al registrar el pedido. Intente nuevamente." });
    }
  },
  zod$({
    customerName: z.string().min(1, "El nombre es obligatorio"),
    customerPhone: z.string().min(1, "El teléfono es obligatorio"),
    customerEmail: z.string().optional(),
    items: z.string(),
    totalAmount: z.string(),
  })
);

export default component$(() => {
  const activePitches = usePitchesLoader();
  const user = useUserLoader();
  const instagramFeed = useInstagramFeed();
  const aiSettings = useAISettingsLoader();
  const gallery = useGalleryLoader();
  const guestAction = useGuestBookingAction();
  const userAction = useUserBookingAction();
  const confirmarPagoPaywayAction = useConfirmarPagoPayway();
  const productsData = useActiveProducts();
  const checkoutAction = useCheckoutAction();

  const isModalOpen = useSignal(false);
  const selectedPitchId = useSignal("");
  const prefilledDate = useSignal("");
  const prefilledTime = useSignal("");
  const prefilledDuration = useSignal("60");

  const openBookingModal = $((pitchId: string) => {
    prefilledDate.value = "";
    prefilledTime.value = "";
    prefilledDuration.value = "60";
    selectedPitchId.value = pitchId;
    isModalOpen.value = true;
  });

  const openBookingModalWithTime = $((pitchId: string, dateStr: string, time: string, durationMins?: number) => {
    prefilledDate.value = dateStr;
    prefilledTime.value = time;
    prefilledDuration.value = String(durationMins || 60);
    selectedPitchId.value = pitchId;
    isModalOpen.value = true;
  });

  const closeBookingModal = $(() => {
    isModalOpen.value = false;
    selectedPitchId.value = "";
  });

  return (
    <div class="min-h-screen bg-slate-950 pb-0 font-sans text-white selection:bg-emerald-500 selection:text-white">
      <HomeNavbar
        user={user.value}
        showGalleryLink={gallery.value.length > 0}
        showSchoolLink={(aiSettings.value?.schoolCategories || []).length > 0}
        showStoreLink={aiSettings.value?.storeEnabled !== false && productsData.value.length > 0}
      />

      <HeroSlider slides={aiSettings.value?.heroSlides} />

      <HistorySection texts={aiSettings.value?.landingTexts} />

      <SectionDivider topColor="bg-[#001407]" bottomColor="bg-[#F5F2EB]" />

      <PitchesGrid
        pitches={activePitches.value}
        onReserve={openBookingModal}
        onReserveWithTime$={openBookingModalWithTime}
        operatingHours={aiSettings.value?.operatingHours || []}
        holidays={aiSettings.value?.holidays || []}
        theme="light"
      />

      <SectionDivider
        topColor="bg-[#F5F2EB]"
        bottomColor="bg-slate-950"
        flip={true}
        invert={true}
      />

      <SchoolSection
        categories={aiSettings.value?.schoolCategories || []}
        theme="dark"
      />

      {aiSettings.value?.storeEnabled !== false && productsData.value.length > 0 && (
        <StoreSection products={productsData.value} checkoutAction={checkoutAction} />
      )}

      <ReelsSection reels={aiSettings.value?.reels || []} />

      <GallerySection images={gallery.value.slice(0, 12)} />

      <SectionDivider topColor="bg-slate-950" bottomColor="bg-[#F5F2EB]" />

      <ContactSection settings={aiSettings.value ?? {}} theme="light" />

      <SectionDivider
        topColor="bg-[#F5F2EB]"
        bottomColor="bg-slate-950"
        flip={true}
        invert={true}
      />

      <SocialFeed posts={instagramFeed.value} />

      {aiSettings.value?.aiEnabled !== false && (
        <Chatbot avatarUrl={aiSettings.value?.aiAvatarUrl || undefined} />
      )}

      <WhatsAppButton
        phone={aiSettings.value?.clubPhone || aiSettings.value?.whatsappNumber || "5491112345678"}
      />

      <PromoPopup popup={aiSettings.value?.promoPopup} />

      <HomeBookingModal
        isOpen={isModalOpen}
        selectedPitchId={selectedPitchId}
        onClose={closeBookingModal}
        pitches={activePitches.value}
        user={user.value}
        settings={aiSettings.value ?? {}}
        guestAction={guestAction}
        userAction={userAction}
        confirmarPagoPaywayAction={confirmarPagoPaywayAction}
        initialDate={prefilledDate}
        initialTime={prefilledTime}
        initialDuration={prefilledDuration}
      />

      <HomeFooter settings={aiSettings.value ?? {}} />
    </div>
  );
});

export const head: DocumentHead = {
  title: "GardenClubFutbol - El Mejor Fútbol",
  meta: [
    {
      name: "description",
      content:
        "Alquiler de canchas de fútbol premium. Reserva tu turno online en GardenClubFutbol.",
    },
  ],
};
