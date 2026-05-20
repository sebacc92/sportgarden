import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, zod$, z, Link } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { hashPassword, createSessionJWT } from "~/lib/auth";
import { Button, Alert } from "~/components/ui";
import logo from "~/media/logo-removebg-preview.png";

export const useRegisterAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (existingUser) {
      return requestEvent.fail(400, {
        message: "Ya existe un usuario con este correo electrónico.",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);
    const id = crypto.randomUUID();

    // Create user
    await db.insert(users).values({
      id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      role: "REGISTERED",
    });

    // Create session
    const token = await createSessionJWT(id, "REGISTERED");

    requestEvent.cookie.set("session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: [7, "days"],
    });

    // Redirect to home or previous page
    throw requestEvent.redirect(302, "/");
  },
  zod$({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Correo electrónico inválido"),
    phone: z.string().min(8, "Teléfono inválido"),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
  }),
);

export default component$(() => {
  const registerAction = useRegisterAction();

  return (
    <div class="flex min-h-screen flex-col justify-center bg-slate-950 py-12 font-sans selection:bg-emerald-500 selection:text-white sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" class="mb-6 flex justify-center">
          <img
            src={logo}
            alt="Garden Club Logo"
            width={240}
            height={74}
            class="h-16 w-auto object-contain transition-transform duration-500 hover:scale-105"
          />
        </Link>
        <h2 class="text-center text-3xl font-bold tracking-tight text-white">
          Crea tu cuenta
        </h2>
        <p class="mt-2 text-center text-sm text-slate-400">
          O{" "}
          <Link
            href="/auth/login"
            class="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            inicia sesión si ya tienes una
          </Link>
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="border border-white/5 bg-slate-900 px-4 py-8 shadow-2xl shadow-emerald-900/10 sm:rounded-3xl sm:px-10">
          <Form action={registerAction} class="space-y-6">
            {registerAction.value?.message && (
              <Alert.Root
                look="alert"
                class="rounded-xl border-red-500/20 bg-red-500/10 text-red-400"
              >
                <Alert.Description>
                  {registerAction.value.message}
                </Alert.Description>
              </Alert.Root>
            )}

            <div>
              <label
                for="name"
                class="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Nombre Completo
              </label>
              <div class="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                for="email"
                class="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Correo Electrónico
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                for="phone"
                class="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Teléfono (WhatsApp)
              </label>
              <div class="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                for="password"
                class="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Contraseña
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                look="primary"
                disabled={registerAction.isRunning}
                class="flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black tracking-wider text-white uppercase hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none"
              >
                {registerAction.isRunning ? "Registrando..." : "Crear Usuario"}
              </Button>
            </div>
          </Form>

          <div class="relative my-6 flex items-center py-1">
            <div class="flex-grow border-t border-white/10"></div>
            <span class="mx-3 flex-shrink text-[10px] font-black tracking-widest text-slate-500 uppercase">
              O continuá con
            </span>
            <div class="flex-grow border-t border-white/10"></div>
          </div>

          <div>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-800 px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-700 active:scale-98"
            >
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Crear Cuenta - GardenClubFutbol",
};
