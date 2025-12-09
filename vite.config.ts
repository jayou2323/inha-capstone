import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: false,
        },
        // Lambda Function URL 프록시 (CORS 문제 우회)
        "/lambda": {
          target: env.VITE_LAMBDA_BASE_URL || "https://example.lambda-url.ap-northeast-2.on.aws",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/lambda/, ""),
          secure: true,
          configure: (proxy, _options) => {
            proxy.on("proxyReq", (proxyReq, _req, _res) => {
              // Lambda API 키를 헤더에 추가
              const apiKey = env.VITE_LAMBDA_API_KEY;
              if (apiKey) {
                proxyReq.setHeader("x-api-key", apiKey);
              }
            });
          },
        },
      },
    },
  };
});
