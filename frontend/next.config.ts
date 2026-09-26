import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:8000';
    const url = new URL(backend);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error(
        'BACKEND_URL must be an HTTP(S) URL without credentials.',
      );
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backend.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
