import type { RequestHandler } from "@builder.io/qwik-city";
import { verifySessionJWT } from "~/lib/auth";
import { getDB } from "~/db";
import { users } from "~/db/schema";

export const onRequest: RequestHandler = async (event) => {
  const { url, cookie } = event;

  let loggedInUser = null;

  // 1. Try Google / Auth.js session first (populated by plugin@auth)
  const authSession = event.sharedMap.get("session") as any;
  if (authSession?.user?.email) {
    try {
      const db = getDB(event);
      const { data: user, error } = await db
        .from(users)
        .select("id, name, email, phone, role")
        .eq("email", authSession.user.email)
        .maybeSingle();

      if (user && !error) {
        loggedInUser = {
          userId: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          phone: user.phone,
        };
      }
    } catch (err) {
      console.error("Error loading Google user in session plugin:", err);
    }
  }

  // 2. Fall back to custom cookie "session"
  if (!loggedInUser) {
    const clientSession = cookie.get("session");
    if (clientSession?.value) {
      const payload = await verifySessionJWT(clientSession.value);
      if (payload) {
        try {
          const db = getDB(event);
          const { data: user, error } = await db
            .from(users)
            .select("id, name, email, phone, role")
            .eq("id", payload.userId)
            .maybeSingle();

          if (user && !error) {
            loggedInUser = {
              userId: user.id,
              role: user.role,
              name: user.name,
              email: user.email,
              phone: user.phone,
            };
          }
        } catch {
          // If query fails, ignore
        }
      }
    }
  }

  // Set the user in the shared map
  if (loggedInUser) {
    event.sharedMap.set("user", loggedInUser);

    // Redirect logged-in users away from login and register pages to the home page
    if (
      url.pathname.startsWith("/auth/login") ||
      url.pathname.startsWith("/auth/register")
    ) {
      throw event.redirect(302, "/");
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
