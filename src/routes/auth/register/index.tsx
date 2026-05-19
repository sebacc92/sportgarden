import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, zod$, z, Link } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { hashPassword, createSessionJWT } from "~/lib/auth";
import { Button, Alert } from "~/components/ui";

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
        <Link
          href="/"
          class="mb-6 block text-center text-3xl font-black tracking-tighter text-white uppercase"
        >
          Sport<span class="text-emerald-400">Garden</span>
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
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Crear Cuenta - GardenClubFutbol",
};
