import { component$, useSignal, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  useGuestBookingAction,
  useUserBookingAction,
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
import { RollingBall } from "~/components/home/rolling-ball";
import { HomeNavbar } from "~/components/home/home-navbar";
import { HeroSlider } from "~/components/home/hero-slider";
import { HistorySection } from "~/components/home/history-section";
import { PitchesGrid } from "~/components/home/pitches-grid";
import { GallerySection } from "~/components/home/gallery-section";
import { ContactSection } from "~/components/home/contact-section";
import { HomeFooter } from "~/components/home/home-footer";
import { HomeBookingModal } from "~/components/home/home-booking-modal";
import { SchoolSection } from "~/components/home/school-section";
import { SectionDivider } from "~/components/home/section-divider";

export { useGuestBookingAction, useUserBookingAction };
export {
  usePitchesLoader,
  useUserLoader,
  useInstagramFeed,
  useAISettingsLoader,
  useGalleryLoader,
};
export { getDailyBookings } from "~/lib/home-page/loaders";

export default component$(() => {
  const activePitches = usePitchesLoader();
  const user = useUserLoader();
  const instagramFeed = useInstagramFeed();
  const aiSettings = useAISettingsLoader();
  const gallery = useGalleryLoader();
  const guestAction = useGuestBookingAction();
  const userAction = useUserBookingAction();

  const isModalOpen = useSignal(false);
  const selectedPitchId = useSignal("");

  const openBookingModal = $((pitchId: string) => {
    selectedPitchId.value = pitchId;
    isModalOpen.value = true;
  });

  const closeBookingModal = $(() => {
    isModalOpen.value = false;
    selectedPitchId.value = "";
  });

  return (
    <div class="min-h-screen bg-slate-950 pb-20 font-sans text-white selection:bg-emerald-500 selection:text-white">
      <HomeNavbar
        user={user.value}
        showGalleryLink={gallery.value.length > 0}
        showSchoolLink={(aiSettings.value?.schoolCategories || []).length > 0}
      />

      <HeroSlider />

      <HistorySection />

      <SectionDivider topColor="bg-slate-950" bottomColor="bg-[#F5F2EB]" />

      <PitchesGrid
        pitches={activePitches.value}
        onReserve={openBookingModal}
        theme="light"
      />

      <SchoolSection
        categories={aiSettings.value?.schoolCategories || []}
        theme="light"
      />

      <SectionDivider
        topColor="bg-[#F5F2EB]"
        bottomColor="bg-slate-950"
        flip={true}
        invert={true}
      />

      <GallerySection images={gallery.value} />

      <SectionDivider topColor="bg-slate-950" bottomColor="bg-[#F5F2EB]" />

      <ContactSection settings={aiSettings.value ?? {}} theme="light" />

      <SectionDivider
        topColor="bg-[#F5F2EB]"
        bottomColor="bg-slate-950"
        flip={true}
        invert={true}
      />

      <RollingBall />

      <SocialFeed posts={instagramFeed.value} />

      {aiSettings.value?.aiEnabled !== false && (
        <Chatbot avatarUrl={aiSettings.value?.aiAvatarUrl || undefined} />
      )}

      <WhatsAppButton
        phone={aiSettings.value?.whatsappNumber || "5491112345678"}
      />

      <HomeBookingModal
        isOpen={isModalOpen}
        selectedPitchId={selectedPitchId}
        onClose={closeBookingModal}
        pitches={activePitches.value}
        user={user.value}
        settings={aiSettings.value ?? {}}
        guestAction={guestAction}
        userAction={userAction}
      />

      <HomeFooter />
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
