import { defineConfig, devices } from "@playwright/test";

const port = 3432;
const baseURL = process.env.JOBMATCH_TEST_URL ?? `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:"src/tests/e2e",
  timeout:45_000,
  fullyParallel:false,
  workers:1,
  reporter:"list",
  use:{
    ...devices["Desktop Chrome"],
    baseURL,
    channel:process.env.PLAYWRIGHT_CHROME === "1" ? "chrome" : undefined,
    trace:"retain-on-failure",
  },
  webServer:process.env.JOBMATCH_TEST_URL ? undefined : {
    command:`node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url:baseURL,
    reuseExistingServer:!process.env.CI,
    timeout:60_000,
  },
});
