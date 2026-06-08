/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  staticPageGenerationTimeout: 120,

  // sockjs-client → debug → supports-color (Node-only); stub for browser bundle
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'supports-color': false,
    };
    return config;
  },
  
  // Restrict backend proxying to local development only.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*'
      }
    ];
  }
};

export default nextConfig;
