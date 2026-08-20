/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Forge design layer (src/forge/**) is a CLI, not part of the web build.
  // It is typechecked separately via `npm run forge:build`.
  eslint: { dirs: ["app", "lib", "components"] },
};

module.exports = nextConfig;
