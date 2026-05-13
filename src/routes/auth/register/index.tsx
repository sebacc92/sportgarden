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
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  })
);

export default component$(() => {
  const registerAction = useRegisterAction();

  return (
    <div class="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-white">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" class="block text-center font-black text-3xl tracking-tighter uppercase text-white mb-6">
          Sport<span class="text-emerald-500">Garden</span>
        </Link>
        <h2 class="text-center text-3xl font-bold tracking-tight text-white">
          Crea tu cuenta
        </h2>
        <p class="mt-2 text-center text-sm text-slate-400">
          O{" "}
          <Link href="/auth/login" class="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            inicia sesión si ya tienes una
          </Link>
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-slate-900 py-8 px-4 shadow-2xl shadow-emerald-900/10 sm:rounded-3xl sm:px-10 border border-white/5">
          <Form action={registerAction} class="space-y-6">
            
            {registerAction.value?.message && (
              <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                <Alert.Description>{registerAction.value.message}</Alert.Description>
              </Alert.Root>
            )}

            <div>
              <label for="name" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Nombre Completo
              </label>
              <div class="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

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
              <label for="phone" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Teléfono (WhatsApp)
              </label>
              <div class="mt-1">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label for="password" class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  required
                  class="block w-full appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                look="primary"
                disabled={registerAction.isRunning}
                class="flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black uppercase tracking-wider text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
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
