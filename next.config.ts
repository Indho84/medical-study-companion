import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds a plain static site (free mode only) for GitHub Pages.
// NEXT_PUBLIC_BASE_PATH is the sub-path the site is served from, e.g. "/medical-study-companion".
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport && { output: "export", trailingSlash: true }),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  env: { NEXT_PUBLIC_STATIC_EXPORT: staticExport ? "1" : "0" },
};

export default nextConfig;
