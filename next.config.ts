import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    FELTDB_TELEMETRY: "false",
  },
};

export default nextConfig;
