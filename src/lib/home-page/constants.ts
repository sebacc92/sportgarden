export const HERO_SLIDES = [
  {
    image: "/slider1.png",
    title: "La Cancha Es Tuya",
    subtitle: "Instalaciones premium y césped de última generación.",
  },
  {
    image: "/slider2.png",
    title: "Fútbol Profesional",
    subtitle: "Siente la verdadera pasión con el mejor equipamiento.",
  },
  {
    image: "/slider3.png",
    title: "Tercer Tiempo",
    subtitle: "Comparte con tus amigos después de cada partido.",
  },
] as const;

/** Horarios en pasos de 30 min (08:00–23:30), generado una sola vez en módulo. */
export const TIME_SLOT_OPTIONS: readonly string[] = (() => {
  const opts: string[] = [];
  for (let h = 8; h <= 23; h++) {
    opts.push(`${h.toString().padStart(2, "0")}:00`);
    opts.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return opts;
})();

export const DEFAULT_CLUB_SERVICES = [
  "Wi-Fi",
  "Vestuario",
  "Ayuda Médica",
  "Torneos",
  "Colegios",
  "Bar / Restaurante",
  "Estacionamiento",
  "Cumpleaños",
] as const;
