import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is almost entirely per-user (auth cookies), so we use classic dynamic rendering.
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // screenshots up to 5 MB
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
