import type { RequestHandler } from "@builder.io/qwik-city";
import { verifySessionJWT } from "~/lib/auth";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export const onRequest: RequestHandler = async (event) => {
  const { url, cookie } = event;

  // --- Sesión de clientes registrados (cookie "session") ---
  // Se lee en todas las rutas para identificar al usuario cliente
  const clientSession = cookie.get("session");
  if (clientSession?.value) {
    const payload = await verifySessionJWT(clientSession.value);
    if (payload) {
      try {
        const db = getDB(event);
        const user = await db.query.users.findFirst({
          where: eq(users.id, payload.userId),
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        });
        if (user) {
          event.sharedMap.set("user", {
            userId: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            phone: user.phone,
          });
        }
      } catch {
        // Si falla el query, simplemente no seteamos el usuario
      }
    }
  }

  // --- Protección de rutas /admin ---
  if (!url.pathname.startsWith("/admin")) {
    return;
  }

  const isLogin = url.pathname.startsWith("/admin/login");

  // Si es un request a un asset o archivo estático bajo /admin, lo dejamos pasar
  const isAsset =
    url.pathname.match(
      /\.(css|js|png|jpg|jpeg|svg|webp|ico|json|woff|woff2|ttf|eot)$/,
    ) !== null;

  if (!isLogin && !isAsset) {
    const adminSession = cookie.get("auth_session");

    if (!adminSession || !adminSession.value) {
      throw event.redirect(302, "/admin/login/");
    }
  } else if (isLogin) {
    const adminSession = cookie.get("auth_session");
    if (adminSession && adminSession.value) {
      // Si ya está logueado y trata de entrar al login, lo mandamos al dashboard
      throw event.redirect(302, "/admin/");
    }
  }
};
