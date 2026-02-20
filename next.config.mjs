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

    // Windows 시스템 파일을 파일 감시 대상에서 제외 (Watchpack EPERM 오류 방지)
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/.git/**",
        "**/node_modules/**",
        "C:/pagefile.sys",
        "C:/hiberfil.sys",
        "C:/swapfile.sys",
      ],
    };

    return config;
  },

  // Next.js 14.1+ 에서 experimental에서 루트 레벨로 이동된 옵션
  serverExternalPackages: [
    "@huggingface/transformers",
    "pdf-parse",
    "onnxruntime-node",
  ],
};

export default nextConfig;
