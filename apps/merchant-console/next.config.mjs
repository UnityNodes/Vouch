/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@agentcheckout/shared",
    "@agentcheckout/zerogravity",
    "@agentcheckout/mcp",
  ],
  // standalone output makes `next build` produce a self-contained .next/standalone
  // tree that the production Dockerfile can copy into a minimal runtime image.
  // Disabled on Windows dev (symlink permission errors); enabled in production
  // Dockerfile via NEXT_OUTPUT_STANDALONE=1.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1"
    ? {
        output: "standalone",
        outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
      }
    : {}),
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 0G SDKs use Node built-ins (node:module createRequire, fs, crypto).
      // Leave them as external require()s so webpack doesn't try to bundle them.
      // Safe — these are only loaded in live mode, never in the hosted mock demo.
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      externals.push({
        "@0gfoundation/0g-compute-ts-sdk": "commonjs @0gfoundation/0g-compute-ts-sdk",
        "@0gfoundation/0g-storage-ts-sdk": "commonjs @0gfoundation/0g-storage-ts-sdk",
      });
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
