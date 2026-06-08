/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  staticPageGenerationTimeout: 120,
  
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
