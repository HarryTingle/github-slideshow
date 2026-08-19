/** @type {import('next').NextConfig} */
const nextConfig = {
  // The engine ships as TypeScript source — it is compiled as part of the app so there
  // is no build step between changing a formula and seeing it in the UI.
  transpilePackages: ['@scope/engine'],
};

export default nextConfig;
