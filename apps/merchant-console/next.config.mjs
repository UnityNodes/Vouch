/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@agentcheckout/shared", "@agentcheckout/cleanverse", "@agentcheckout/mcp"],
};

export default nextConfig;
