import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.{test,spec}.js"],
    exclude: [
      "**/e2e/**",
      "**/node_modules/**",
      "**/.*/**",
    ],
  },
});

