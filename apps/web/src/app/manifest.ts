import { SPLASH_COLOR, THEME_COLOR } from "@/lib/theme-color";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "College Ess — Student Life Platform",
    short_name: "College Ess",
    description:
      "Offline-first student life platform for wardrobe, routines, habits, exams, and campus guidance.",
    // A signed-in launch goes straight here; a signed-out one is sent on to the welcome page.
    start_url: "/dashboard",
    display: "standalone",
    background_color: SPLASH_COLOR,
    theme_color: THEME_COLOR,
    // Made from the logo (docs/logo.png). The mark sits inside the maskable safe zone (the
    // central circle, 80% across), so one image serves both purposes.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
