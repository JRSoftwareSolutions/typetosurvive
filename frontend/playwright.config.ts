import { defineConfig, devices } from "@playwright/test";

const FRONTEND_URL = process.env.PW_FRONTEND_URL || "http://127.0.0.1:5173";
const BACKEND_URL = process.env.VITE_API_BASE_URL || "http://127.0.0.1:3001/api";
const BACKEND_PORT = Number(process.env.PW_BACKEND_PORT || "3001");
const FRONTEND_PORT = Number(process.env.PW_FRONTEND_PORT || "5173");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start --prefix ../backend",
      port: BACKEND_PORT,
      reuseExistingServer: true,
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      env: {
        ...process.env,
        VITE_API_BASE_URL: BACKEND_URL,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

