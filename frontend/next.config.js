/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kf.kobotoolbox.org",
      },
      {
        protocol: "https",
        hostname: "**.kobotoolbox.org",
      },
    ],
  },
};

export default nextConfig;
