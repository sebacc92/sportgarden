import { routeAction$ } from "@builder.io/qwik-city";

export const useLogoutAction = routeAction$(async (_, requestEvent) => {
  requestEvent.cookie.delete("session", { path: "/" });

  // Delete all standard Auth.js cookies (both HTTP development and HTTPS production)
  const authjsCookies = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.state",
    "__Secure-authjs.state",
  ];
  for (const name of authjsCookies) {
    requestEvent.cookie.delete(name, { path: "/" });
  }

  throw requestEvent.redirect(302, "/");
});
