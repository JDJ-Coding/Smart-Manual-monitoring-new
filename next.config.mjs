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

  experimental: {
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "pdf-parse",
      "onnxruntime-node",
    ],
    // src/instrumentation.ts 의 register() 를 서버 부팅 시 자동 실행
    // → 임베딩 모델 Cold Start 10~20초 지연 제거
    instrumentationHook: true,
  },
};

export default nextConfig;
