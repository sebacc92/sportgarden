import { component$ } from "@builder.io/qwik";

export interface InstagramPostProps {
  id: string;
  imageUrl: string;
  link: string;
  caption?: string;
  likes?: number;
}

export const MOCK_INSTAGRAM_POSTS: InstagramPostProps[] = [
  {
    id: "post-1",
    imageUrl: "/slider1.png",
    link: "#",
    likes: 342,
    caption: "¡Noche espectacular en la F5 principal!",
  },
  {
    id: "post-2",
    imageUrl: "/slider2.png",
    link: "#",
    likes: 512,
    caption: "La pelota rodando bajo las nuevas luces LED.",
  },
  {
    id: "post-3",
    imageUrl: "/slider3.png",
    link: "#",
    likes: 289,
    caption: "Festejando el triunfo. ¡El tercer tiempo es nuestro!",
  },
  {
    id: "post-4",
    imageUrl: "/slider1.png",
    link: "#",
    likes: 876,
    caption: "Torneo de verano en GardenClubFutbol. Inscribite ya.",
  },
  {
    id: "post-5",
    imageUrl: "/slider2.png",
    link: "#",
    likes: 120,
    caption: "El campo de juego en perfectas condiciones.",
  },
  {
    id: "post-6",
    imageUrl: "/slider3.png",
    link: "#",
    likes: 450,
    caption: "Pasión por el fútbol todos los días.",
  },
];

type SocialFeedProps = {
  posts?: InstagramPostProps[];
};

export const SocialFeed = component$<SocialFeedProps>(({ posts }) => {
  const safePosts = posts && posts.length > 0 ? posts : MOCK_INSTAGRAM_POSTS;

  return (
    <section class="relative z-20 bg-slate-950 py-24 text-white">
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div class="mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:px-8">
        <header class="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div class="text-center md:text-left">
            <p class="mb-2 text-xs font-bold tracking-[0.35em] text-emerald-400">
              COMUNIDAD · FÚTBOL · AMIGOS
            </p>
            <h2 class="text-3xl leading-tight font-black tracking-[0.25em] text-white uppercase md:text-4xl">
              @gardenclubfutbol
            </h2>
          </div>

          <a
            href="https://www.instagram.com/gardenclubfutbol/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-3 rounded-full border-2 border-white/20 bg-slate-900 px-6 py-3 text-xs font-black tracking-[0.25em] text-white uppercase transition-all hover:-translate-y-1 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-900/30"
          >
            <span>Ver perfil</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>
        </header>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-6">
          {safePosts.map((post) => (
            <a
              key={post.id}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              class="group relative block aspect-square overflow-hidden rounded-2xl border border-white/5 bg-slate-900 shadow-md"
            >
              <img
                src={post.imageUrl}
                alt={post.caption || "Post de Instagram de GardenClubFutbol"}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />

              <div class="absolute inset-0 flex items-center justify-center bg-slate-950/70 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                <div class="flex flex-col items-center gap-2 px-2 text-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="mb-1 h-8 w-8 text-emerald-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>

                  {post.likes && (
                    <div class="flex items-center gap-2 text-xs font-bold tracking-[0.25em] uppercase">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span>{post.likes}</span>
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
});
