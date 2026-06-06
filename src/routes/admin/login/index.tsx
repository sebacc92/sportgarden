import { component$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { users } from "~/db/schema";
import bcrypt from "bcryptjs";

export const useLoginAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // Buscar usuario por nombre de usuario y asegurarse que sea ADMIN
    const { data: userData, error } = await db
      .from(users)
      .select("*")
      .eq("name", data.username.trim().toLowerCase())
      .in("role", ["DEV", "OWNER", "MANAGER", "EMPLOYEE"])
      .maybeSingle();

    if (error) throw error;
    const user = camelize<any>(userData);

    if (!user || !user.password) {
      return requestEvent.fail(401, {
        error: "Credenciales incorrectas o usuario no es administrador.",
      });
    }

    // Verificar hash de contraseña
    const isValid = bcrypt.compareSync(data.password, user.password);

    if (!isValid) {
      return requestEvent.fail(401, {
        error: "Credenciales incorrectas o usuario no es administrador.",
      });
    }

    // Setear cookie de sesión con el ID del usuario
    requestEvent.cookie.set("auth_session", String(user.id), {
      httpOnly: true,
      secure: true,
      maxAge: [15, "days"],
      path: "/",
    });

    // Update lastLoginAt
    const { error: updErr } = await db
      .from(users)
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updErr) throw updErr;

    throw requestEvent.redirect(302, "/admin/calendar/");
  },
  zod$({
    username: z.string().min(1, "Ingresa un usuario"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  }),
);

export const head: DocumentHead = {
  title: "Login — Admin | GardenClubFutbol",
};

export default component$(() => {
  const action = useLoginAction();

  return (
    <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      {/* Background decoration */}
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div class="relative w-full max-w-sm">
        {/* Logo / Brand */}
        <div class="mb-10 text-center">
          <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <span class="text-2xl font-black tracking-tighter text-slate-950">
              SG
            </span>
          </div>
          <h1 class="text-2xl font-black tracking-tighter text-white uppercase">
            Acceso Administrador
          </h1>
          <p class="mt-1 text-sm text-slate-400">GardenClubFutbol</p>
        </div>

        {/* Card */}
        <div class="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <h2 class="mb-6 text-base font-semibold text-white">
            Iniciar sesión
          </h2>

          <Form action={action} class="space-y-5">
            <div>
              <label
                for="username"
                class="mb-2 block text-xs font-semibold tracking-widest text-slate-400 uppercase"
              >
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autocomplete="username"
                required
                class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="admin"
              />
              {action.value?.fieldErrors?.username && (
                <p class="mt-1.5 text-xs text-red-400">
                  {action.value.fieldErrors.username}
                </p>
              )}
            </div>

            <div>
              <label
                for="password"
                class="mb-2 block text-xs font-semibold tracking-widest text-slate-400 uppercase"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="••••••••"
              />
              {action.value?.fieldErrors?.password && (
                <p class="mt-1.5 text-xs text-red-400">
                  {action.value.fieldErrors.password}
                </p>
              )}
            </div>

            {action.value?.error && (
              <div class="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 shrink-0 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width={2}
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p class="text-sm text-red-400">{action.value.error}</p>
              </div>
            )}

            <button
              type="submit"
              class="w-full rounded-lg bg-emerald-500 py-3 text-sm font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:bg-emerald-600 disabled:opacity-60"
            >
              {action.isRunning ? "Verificando..." : "Ingresar"}
            </button>
          </Form>
        </div>

        <p class="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} GardenClubFutbol
        </p>
      </div>
    </div>
  );
});
