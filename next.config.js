/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['googleapis'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};

module.exports = nextConfig;
