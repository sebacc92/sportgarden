import { component$ } from "@builder.io/qwik";

interface SectionDividerProps {
  topColor: string; // Tailwind class like "bg-slate-950" or hex color like "#F5F2EB"
  bottomColor: string; // Tailwind class like "bg-slate-950" or hex color like "#F5F2EB"
  flip?: boolean; // Flips horizontally
  invert?: boolean; // Flips vertically
  heightClass?: string; // Custom height class, defaults to "h-8 sm:h-12 md:h-16 lg:h-20"
}

export const SectionDivider = component$<SectionDividerProps>(
  ({
    topColor,
    bottomColor,
    flip = false,
    invert = false,
    heightClass = "h-8 sm:h-12 md:h-16 lg:h-20",
  }) => {
    // Check if the color is a hex/rgb code or a Tailwind class
    const isTopHex = topColor.startsWith("#") || topColor.startsWith("rgb");
    const isBottomHex =
      bottomColor.startsWith("#") || bottomColor.startsWith("rgb");

    // The container background will match the topColor, and the SVG path will match the bottomColor.
    // If invert is true, we swap them.
    const containerColor = invert ? bottomColor : topColor;
    const pathColor = invert ? topColor : bottomColor;

    const containerStyle =
      (isTopHex || isBottomHex) && !containerColor.startsWith("bg-")
        ? { backgroundColor: containerColor }
        : undefined;

    const containerClass =
      !containerColor.startsWith("#") && !containerColor.startsWith("rgb")
        ? containerColor
        : "";

    const pathStyle =
      (isTopHex || isBottomHex) && !pathColor.startsWith("bg-")
        ? { fill: pathColor }
        : undefined;

    const pathClass =
      !pathColor.startsWith("#") && !pathColor.startsWith("rgb")
        ? pathColor.replace("bg-", "fill-") // convert e.g., "bg-[#F5F2EB]" to "fill-[#F5F2EB]"
        : "";

    // Math for scaling around the center of the 1200x120 viewBox
    const scaleX = flip ? -1 : 1;
    const scaleY = invert ? -1 : 1;
    const transformStr =
      flip || invert
        ? `translate(600, 60) scale(${scaleX}, ${scaleY}) translate(-600, -60)`
        : undefined;

    return (
      <div
        class={`relative z-30 w-full overflow-hidden leading-none ${heightClass} ${containerClass}`}
        style={containerStyle}
      >
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          class="relative block h-full w-full"
        >
          <path
            d="M0,0 C300,120 900,0 1200,120 L1200,120 L0,120 Z"
            class={pathClass}
            style={pathStyle}
            transform={transformStr}
          />
        </svg>
      </div>
    );
  },
);
