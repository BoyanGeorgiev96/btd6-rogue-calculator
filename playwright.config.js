import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', workers:process.env.CI?2:undefined, fullyParallel:true, forbidOnly:Boolean(process.env.CI), retries:process.env.CI?1:0,
  use:{baseURL:'http://127.0.0.1:5179',viewport:{width:1440,height:900},trace:process.env.CI?'on-first-retry':'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:5179',env:{PORT:'5179'},reuseExistingServer:!process.env.CI},
  reporter:process.env.CI?[['list'],['github']]:'list'
});
