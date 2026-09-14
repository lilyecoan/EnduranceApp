import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Dockerfile's multi-stage build, which copies
  // .next/standalone — without this, `next build` never produces that
  // directory and the Docker image build fails.
  output: "standalone",
};

export default nextConfig;
