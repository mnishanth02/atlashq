import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@atlashq/api-client": fileURLToPath(
        new URL("../../packages/api-client/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "src/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          fileParallelism: false,
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
