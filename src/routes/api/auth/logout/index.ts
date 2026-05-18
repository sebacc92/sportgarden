import { routeAction$ } from "@builder.io/qwik-city";

export const useLogoutAction = routeAction$(async (_, requestEvent) => {
  requestEvent.cookie.delete("session", { path: "/" });
  throw requestEvent.redirect(302, "/");
});
