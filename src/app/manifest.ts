import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loxam Module Yard",
    short_name: "Module Yard",
    description: "Internal yard management for Loxam Module Schelle",
    start_url: "/nl",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c41e3a",
    lang: "nl",
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
    ],
  };
}
