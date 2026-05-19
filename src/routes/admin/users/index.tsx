import { component$, $, useSignal, useTask$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq, inArray, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { Button, Modal } from "~/components/ui";
import { LuPlus, LuTrash2, LuSettings } from "@qwikest/icons/lucide";
import bcrypt from "bcryptjs";

// 1. Data Loaders
export const useAdminUser = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const adminId = requestEvent.cookie.get("auth_session")?.value;
  if (!adminId) throw requestEvent.redirect(302, "/admin/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, adminId),
  });

  if (!user || !["DEV", "OWNER", "MANAGER"].includes(user.role)) {
    throw requestEvent.redirect(302, "/admin");
  }

  return user;
});

export const useUsersData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.query.users.findMany({
    where: inArray(users.role, ["DEV", "OWNER", "MANAGER", "EMPLOYEE"]),
    orderBy: [desc(users.role), desc(users.createdAt)],
  });
});

// 2. Actions
export const useSaveUserAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const adminId = requestEvent.cookie.get("auth_session")?.value;

    if (!adminId) return requestEvent.fail(401, { message: "No autorizado" });

    const admin = await db.query.users.findFirst({
      where: eq(users.id, adminId),
    });
    if (!admin) return requestEvent.fail(401, { message: "No autorizado" });

    // Jerarquía
    if (admin.role === "MANAGER" && data.role !== "EMPLOYEE") {
      return requestEvent.fail(403, {
        message: "Solo puedes crear empleados.",
      });
    }

    const payload: any = {
      name: data.username.toLowerCase(),
      role: data.role as "DEV" | "OWNER" | "MANAGER" | "EMPLOYEE",
    };

    // Si cambian la contraseña
    if (data.password) {
      payload.password = bcrypt.hashSync(data.password, 10);
    }

    if (data.id) {
      // Editar
      // Prevenir editar a un OWNER si sos MANAGER
      if (admin.role === "MANAGER") {
        const target = await db.query.users.findFirst({
          where: eq(users.id, data.id),
        });
        if (target && (target.role === "OWNER" || target.role === "DEV")) {
          return requestEvent.fail(403, {
            message: "No puedes editar al Dueño o Desarrollador.",
          });
        }
      }

      // Update username si se envió (en la base es 'email', pero nosotros usamos 'name' para el username y name para nombre?)
      // Ojo: en la schema hay 'name' (nombre) y 'email' (usado a veces para login/username).
      // En admin/login/index.tsx busca por users.name. Entonces name = username.
      // Así que 'username' form field -> users.name. Y 'nombreReal' -> users.email o agregamos column?
      // Espera, schema.ts:
      // name: text("name").notNull(), -> usado para username en login.
      // phone: text("phone")
      // No hay columna 'fullName'. Usaremos 'name' para el username (acceso) y 'email' o 'phone' extra.
      // Mejor: el form tendrá "username" mapped to "name" en DB.

      const updatePayload: any = {
        name: data.username.toLowerCase(),
        role: data.role,
      };
      if (data.password)
        updatePayload.password = bcrypt.hashSync(data.password, 10);

      await db.update(users).set(updatePayload).where(eq(users.id, data.id));
    } else {
      // Crear
      if (!data.password)
        return requestEvent.fail(400, {
          message: "La contraseña es obligatoria para nuevos usuarios.",
        });

      const existing = await db.query.users.findFirst({
        where: eq(users.name, data.username.toLowerCase()),
      });
      if (existing)
        return requestEvent.fail(400, { message: "El usuario ya existe." });

      await db.insert(users).values({
        id: crypto.randomUUID(),
        name: data.username.toLowerCase(),
        password: bcrypt.hashSync(data.password, 10),
        role: data.role as any,
      });
    }

    return { success: true };
  },
  zod$({
    id: z.string().optional(),
    username: z.string().min(3, "Mínimo 3 caracteres"),
    password: z.string().optional(),
    role: z.enum(["DEV", "OWNER", "MANAGER", "EMPLOYEE"]),
  }),
);

export const useDeleteUserAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const adminId = requestEvent.cookie.get("auth_session")?.value;

    if (!adminId) return requestEvent.fail(401, { message: "No autorizado" });
    const admin = await db.query.users.findFirst({
      where: eq(users.id, adminId),
    });
    if (!admin) return requestEvent.fail(401, { message: "No autorizado" });

    if (data.id === adminId) {
      return requestEvent.fail(400, {
        message: "No puedes borrarte a ti mismo.",
      });
    }

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.id),
    });
    if (!target)
      return requestEvent.fail(404, { message: "Usuario no encontrado." });

    if (admin.role === "MANAGER" && target.role !== "EMPLOYEE") {
      return requestEvent.fail(403, {
        message: "Solo puedes borrar empleados.",
      });
    }

    await db.delete(users).where(eq(users.id, data.id));
    return { success: true };
  },
  zod$({ id: z.string() }),
);

export const head: DocumentHead = { title: "Usuarios | Admin" };

export default component$(() => {
  const currentAdmin = useAdminUser();
  const usersList = useUsersData();
  const saveAction = useSaveUserAction();
  const deleteAction = useDeleteUserAction();

  const isModalOpen = useSignal(false);
  const editingUser = useSignal<{
    id?: string;
    username: string;
    role: string;
  }>({
    username: "",
    role: "EMPLOYEE",
  });

  const openModal = $((user?: any) => {
    if (user) {
      editingUser.value = { id: user.id, username: user.name, role: user.role };
    } else {
      editingUser.value = { username: "", role: "EMPLOYEE" };
    }
    isModalOpen.value = true;
  });

  useTask$(({ track }) => {
    track(() => saveAction.value);
    if (saveAction.value?.success) {
      isModalOpen.value = false;
    }
  });

  const roleLabels: Record<string, string> = {
    DEV: "Sistemas",
    OWNER: "Dueño",
    MANAGER: "Encargado",
    EMPLOYEE: "Empleado",
  };

  const roleColors: Record<string, string> = {
    DEV: "bg-blue-500 text-white",
    OWNER: "bg-purple-500 text-white",
    MANAGER: "bg-amber-500 text-white",
    EMPLOYEE: "bg-slate-200 text-slate-700",
  };

  return (
    <div class="min-h-full overflow-auto bg-slate-50 p-6 font-sans text-slate-900">
      <header class="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-3xl font-black tracking-tighter text-slate-800 uppercase">
            Usuarios del Sistema
          </h1>
          <p class="mt-1 text-sm font-medium text-slate-500">
            Gestiona accesos y roles del panel administrativo.
          </p>
        </div>
        <Button
          onClick$={() => openModal()}
          look="primary"
          class="flex items-center gap-2 bg-emerald-500 font-black tracking-widest text-white uppercase hover:bg-emerald-600"
        >
          <LuPlus class="h-5 w-5" />
          Nuevo Usuario
        </Button>
      </header>

      <div class="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/50">
              <th class="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase">
                Usuario
              </th>
              <th class="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase">
                Rol
              </th>
              <th class="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase">
                Último Acceso
              </th>
              <th class="px-6 py-4 text-right text-xs font-black tracking-widest text-slate-400 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {usersList.value.map((user) => {
              const canEdit =
                currentAdmin.value?.role === "DEV" ||
                currentAdmin.value?.role === "OWNER" ||
                (currentAdmin.value?.role === "MANAGER" &&
                  user.role === "EMPLOYEE");

              return (
                <tr
                  key={user.id}
                  class="transition-colors hover:bg-slate-50/50"
                >
                  <td class="px-6 py-4 font-bold text-slate-800">
                    {user.name}
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold tracking-widest uppercase ${roleColors[user.role]}`}
                    >
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm font-medium text-slate-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString("es-AR")
                      : "Nunca"}
                  </td>
                  <td class="px-6 py-4 text-right">
                    {canEdit && (
                      <div class="flex items-center justify-end gap-2">
                        <button
                          onClick$={() => openModal(user)}
                          class="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-500"
                        >
                          <LuSettings class="h-4 w-4" />
                        </button>
                        {user.id !== currentAdmin.value?.id && (
                          <Form action={deleteAction}>
                            <input type="hidden" name="id" value={user.id} />
                            <button
                              type="submit"
                              class="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              onClick$={(e) => {
                                if (
                                  !window.confirm(
                                    "¿Seguro que deseas eliminar este usuario?",
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              <LuTrash2 class="h-4 w-4" />
                            </button>
                          </Form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="w-full max-w-md rounded-[2rem] border bg-white p-8 shadow-2xl">
          <Modal.Title class="mb-6 text-2xl font-black tracking-tight text-slate-800">
            {editingUser.value.id ? "Editar Usuario" : "Nuevo Usuario"}
          </Modal.Title>

          <Form action={saveAction} class="space-y-4">
            {editingUser.value.id && (
              <input type="hidden" name="id" value={editingUser.value.id} />
            )}

            {(saveAction.value as any)?.message && (
              <div class="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-500">
                {(saveAction.value as any)?.message}
              </div>
            )}

            <div>
              <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                Usuario (Acceso)
              </label>
              <input
                type="text"
                name="username"
                value={editingUser.value.username}
                required
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                Contraseña{" "}
                {editingUser.value.id && "(Dejar en blanco para no cambiar)"}
              </label>
              <input
                type="password"
                name="password"
                required={!editingUser.value.id}
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none"
              />
            </div>

            {(currentAdmin.value?.role === "OWNER" ||
              currentAdmin.value?.role === "DEV") && (
              <div>
                <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                  Rol
                </label>
                <select
                  name="role"
                  value={editingUser.value.role}
                  class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold focus:ring-2 focus:ring-slate-800 focus:outline-none"
                >
                  <option value="MANAGER">Encargado (Administra todo)</option>
                  <option value="EMPLOYEE">Empleado (Solo Reservas)</option>
                </select>
              </div>
            )}
            {currentAdmin.value?.role === "MANAGER" && (
              <input type="hidden" name="role" value="EMPLOYEE" />
            )}

            <div class="flex gap-3 pt-4">
              <Button
                type="button"
                onClick$={() => (isModalOpen.value = false)}
                look="outline"
                class="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                look="primary"
                disabled={saveAction.isRunning}
                class="flex-1 rounded-xl bg-emerald-500 font-black text-white uppercase hover:bg-emerald-600"
              >
                {saveAction.isRunning ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </Form>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});
