import type { RequestHandler } from "@builder.io/qwik-city";

export const onPost: RequestHandler = async (event) => {
  event.cookie.delete("session", { path: "/" });

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
    event.cookie.delete(name, { path: "/" });
  }

  throw event.redirect(302, "/");
};

export const onGet: RequestHandler = async (event) => {
  return onPost(event);
};
