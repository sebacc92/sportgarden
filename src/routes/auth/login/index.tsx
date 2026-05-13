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
  })
);

export default component$(() => {
  const loginAction = useLoginAction();

  return (
    <div class="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-white">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" class="block text-center font-black text-3xl tracking-tighter uppercase text-white mb-6">
          Sport<span class="text-emerald-500">Garden</span>
        </Link>
        <h2 class="text-center text-3xl font-bold tracking-tight text-white">
          Inicia Sesión
        </h2>
        <p class="mt-2 text-center text-sm text-slate-400">
          O{" "}
          <Link href="/auth/register" class="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            crea una cuenta nueva
          </Link>
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-slate-900 py-8 px-4 shadow-2xl shadow-emerald-900/10 sm:rounded-3xl sm:px-10 border border-white/5">
          <Form action={loginAction} class="space-y-6">
            
            {loginAction.value?.message && (
              <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                <Alert.Description>{loginAction.value.message}</Alert.Description>
              </Alert.Root>
            )}

            <div>
              <label for="email" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label for="password" class="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Contraseña
                </label>
                <div class="text-sm">
                  <a href="#" class="font-medium text-emerald-400 hover:text-emerald-300 transition-colors text-xs">
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
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                look="primary"
                disabled={loginAction.isRunning}
                class="flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
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
