/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable experimental features if needed
  // experimental: {},
  
  // Proxy API calls to backend during development
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8081/api/:path*'
        }
      ]
    };
  }
};

export default nextConfig;
