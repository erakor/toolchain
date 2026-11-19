import base from './oxfmt/index.mjs'

const config = { ...base, ignorePatterns: ['pnpm-lock.yaml', 'test/fixtures/**'] }

export default config
