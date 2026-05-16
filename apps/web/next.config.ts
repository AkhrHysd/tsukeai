import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

if (process.env.NODE_ENV === "development" && process.env.STORYBOOK !== "true") {
  initOpenNextCloudflareForDev();
}
