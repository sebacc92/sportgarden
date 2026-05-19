import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, zod$, z, Link } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { verifyPassword, createSessionJWT } from "~/lib/auth";
import { Button, Alert } from "~/components/ui";

export const useLoginAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (!user || !user.password) {
      return requestEvent.fail(401, {
        message: "Credenciales inválidas.",
      });
    }

    const isValid = await verifyPassword(data.password, user.password);

    if (!isValid) {
      return requestEvent.fail(401, {
        message: "Credenciales inválidas.",
      });
    }

    // Create session
    const token = await createSessionJWT(user.id, user.role);

    requestEvent.cookie.set("session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: [7, "days"],
    });

    throw requestEvent.redirect(302, "/");
  },
  zod$({
    email: z.string().email("Correo electrónico inválido"),
    password: z.string().min(1, "La contraseña es requerida"),
  }),
);

export default component$(() => {
  const loginAction = useLoginAction();

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
          Inicia Sesión
        </h2>
        <p class="mt-2 text-center text-sm text-slate-400">
          O{" "}
          <Link
            href="/auth/register"
            class="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
          >
            crea una cuenta nueva
          </Link>
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="border border-white/5 bg-slate-900 px-4 py-8 shadow-2xl shadow-emerald-900/10 sm:rounded-3xl sm:px-10">
          <Form action={loginAction} class="space-y-6">
            {loginAction.value?.message && (
              <Alert.Root
                look="alert"
                class="rounded-xl border-red-500/20 bg-red-500/10 text-red-400"
              >
                <Alert.Description>
                  {loginAction.value.message}
                </Alert.Description>
              </Alert.Root>
            )}

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
              <div class="mb-2 flex items-center justify-between">
                <label
                  for="password"
                  class="block text-xs font-bold tracking-wider text-slate-400 uppercase"
                >
                  Contraseña
                </label>
                <div class="text-sm">
                  <a
                    href="#"
                    class="text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
              <div class="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                look="primary"
                disabled={loginAction.isRunning}
                class="flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black tracking-wider text-white uppercase hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none"
              >
                {loginAction.isRunning ? "Iniciando..." : "Ingresar"}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Iniciar Sesión - GardenClubFutbol",
};
