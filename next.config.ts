import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Docker build opts into .next/standalone, which lets the image run
  // without devDependencies. Local builds stay on the regular output so
  // `next start` keeps working without the standalone warning.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
