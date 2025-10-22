import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AddRemarks",
    short_name: "AddRemarks",
    description: "Easily upload, view, and manage CSV or Excel files — simple, fast, and reliable.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#12182b",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
