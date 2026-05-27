/**
 * WHAT IS THIS FILE?
 *
 * SSR entry point, in all cases the application is rendered outside the browser, this
 * entry point will be the common one.
 *
 * - Server (express, cloudflare...)
 * - npm run start
 * - npm run preview
 * - npm run build
 *
 */
import {
  renderToStream,
  type RenderToStreamOptions,
} from "@builder.io/qwik/server";
import Root from "./root";

export default function (opts: RenderToStreamOptions) {
  const urlStr = typeof opts.serverData?.url === "string" ? opts.serverData.url : "";
  const isAdmin = urlStr.includes("/admin");

  return renderToStream(<Root />, {
    ...opts,
    // Use container attributes to set attributes on the html tag.
    containerAttributes: {
      lang: "es",
      ...(isAdmin
        ? {}
        : {
            style: "color-scheme: dark;",
          }),
      ...opts.containerAttributes,
      class: (isAdmin
        ? (opts.containerAttributes?.class || "")
        : `dark ${opts.containerAttributes?.class || ""}`
      ).trim(),
    },
    serverData: {
      ...opts.serverData,
    },
  });
}
