import assert from 'node:assert/strict'
import { test } from 'node:test'

import { diagnostics } from './lib/oxlint.mjs'

test('flags secret-looking NEXT_PUBLIC_ reads, including destructured, and secret reads in the next.config env block', () => {
  assert.deepEqual(diagnostics('secret-env', 'secret-env'), [
    'next.config.mjs:2 Error no-secret-in-config-env',
    'next.config.mjs:2 Error no-secret-in-config-env',
    'next.config.mjs:3 Error no-secret-in-config-env',
    'reads.ts:1 Error no-public-secret',
    'reads.ts:2 Error no-public-secret',
    'reads.ts:3 Error no-public-secret',
    'reads.ts:8 Error no-public-secret',
  ])
})
