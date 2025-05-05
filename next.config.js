/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle binary files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Exclude ONNX runtime from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
        'onnxruntime-web': false,
      };
    }

    return config;
  },
  // Exclude ONNX runtime from client bundle
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node'],
  },
};

module.exports = nextConfig; 