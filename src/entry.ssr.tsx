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
if (typeof process === "undefined") {
  (globalThis as any).process = {
    env: {},
    version: "v20.0.0",
    versions: { node: "20.0.0" },
    arch: "x64",
    platform: "linux",
  };
} else {
  if (!process.version) {
    (process as any).version = "v20.0.0";
  }
  if (!process.arch) {
    (process as any).arch = "x64";
  }
  if (!process.platform) {
    (process as any).platform = "linux";
  }
}

if (typeof globalThis.Headers !== "undefined" && !(globalThis.Headers.prototype as any).raw) {
  (globalThis.Headers.prototype as any).raw = function () {
    const rawHeaders: Record<string, string[]> = {};
    this.forEach((value: string, name: string) => {
      rawHeaders[name] = value.split(",").map((v) => v.trim());
    });
    return rawHeaders;
  };
}

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
