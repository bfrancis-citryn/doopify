import { spawnSync } from 'node:child_process'

if (!process.env.DATABASE_URL_TEST) {
  console.log('Skipping integration tests: DATABASE_URL_TEST is not configured.')
  process.exit(0)
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', '--config', 'vitest.integration.config.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL_TEST,
      NODE_ENV: 'test',
    },
  }
)

process.exit(result.status ?? 1)
