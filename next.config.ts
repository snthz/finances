import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: ["imapflow", "mailparser", "pino"],
};

export default nextConfig;
