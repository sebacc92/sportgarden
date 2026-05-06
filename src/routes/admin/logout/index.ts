import type { RequestHandler } from '@builder.io/qwik-city';

// Elimina la cookie de sesión y redirige al login
export const onGet: RequestHandler = (requestEvent) => {
  requestEvent.cookie.delete('auth_session', { path: '/' });
  throw requestEvent.redirect(302, '/admin/login/');
};
