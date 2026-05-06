import type { RequestHandler } from '@builder.io/qwik-city';

export const onRequest: RequestHandler = async (event) => {
  const { url, cookie } = event;

  // Si la ruta no empieza con /admin, permitimos el acceso público sin chequear cookies
  if (!url.pathname.startsWith('/admin')) {
    return;
  }

  const isLogin = url.pathname.startsWith('/admin/login');

  // Si es un request a un asset o archivo estático bajo /admin (como fotos temporales), lo dejamos pasar
  const isAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|ico|json|woff|woff2|ttf|eot)$/) !== null;

  if (!isLogin && !isAsset) {
    const adminSession = cookie.get('auth_session');

    if (!adminSession || !adminSession.value) {
      throw event.redirect(302, '/admin/login/');
    }
  } else if (isLogin) {
    const adminSession = cookie.get('auth_session');
    if (adminSession && adminSession.value) {
      // Si ya está logueado y trata de entrar al login, lo mandamos al dashboard
      throw event.redirect(302, '/admin/');
    }
  }
};
