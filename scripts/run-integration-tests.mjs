import { spawnSync } from 'node:child_process'

if (!process.env.DATABASE_URL_TEST) {
  console.log('Skipping integration tests: DATABASE_URL_TEST is not configured.')
  process.exit(0)
}

const runEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL_TEST,
  NODE_ENV: 'test',
}

const npmExecPath = process.env.npm_execpath

const result = npmExecPath
  ? spawnSync(
      process.execPath,
      [npmExecPath, 'exec', '--', 'vitest', 'run', '--config', 'vitest.integration.config.ts'],
      {
        stdio: 'inherit',
        env: runEnv,
      }
    )
  : spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['vitest', 'run', '--config', 'vitest.integration.config.ts'],
      {
        stdio: 'inherit',
        env: runEnv,
      }
    )

process.exit(result.status ?? 1)
