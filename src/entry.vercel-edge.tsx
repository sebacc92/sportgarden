/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for Vercel Edge when building for production.
 *
 * Learn more about the Vercel Edge integration here:
 * - https://qwik.dev/docs/deployments/vercel-edge/
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
  createQwikCity,
  type PlatformVercel,
} from "@builder.io/qwik-city/middleware/vercel-edge";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

declare global {
  type QwikCityPlatform = PlatformVercel;
}

export default createQwikCity({ render, qwikCityPlan });
