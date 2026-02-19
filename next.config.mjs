/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        { "onnxruntime-node": "commonjs onnxruntime-node" },
      ];
    }

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },

  experimental: {
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "pdf-parse",
      "onnxruntime-node",
    ],
  },
};

export default nextConfig;
