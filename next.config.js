/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    if (isServer) {
      config.externals = [...(config.externals || []), 'sql.js'];
    }
    return config;
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/sql.js/dist/sql-wasm.wasm',
        './public/sql-wasm.wasm',
        './src/lib/schema.sql',
      ],
    },
  },
};

module.exports = nextConfig;
