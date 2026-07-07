import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent billGenieCloud/ has a package-lock.json — pin Turbopack to this app only.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
