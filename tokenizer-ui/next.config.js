/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow large JSON model files + enable WASM for js-tiktoken
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    // js-tiktoken ships a WASM binary; Vercel serverless needs this flag
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

module.exports = nextConfig;
