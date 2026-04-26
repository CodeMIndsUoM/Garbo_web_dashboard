/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  staticPageGenerationTimeout: 120,
  
  // Proxy API calls to backend during development
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/api/:path*'
        }
      ]
    };
  }
};

export default nextConfig;
