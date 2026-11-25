import assert from 'node:assert/strict'
import { test } from 'node:test'

import { diagnostics } from './lib/oxlint.mjs'

test('runs eslint-plugin-storybook on stories and .storybook/main through extends', () => {
  assert.deepEqual(diagnostics('storybook', 'storybook'), [
    '.storybook/main.ts:3 Error no-uninstalled-addons',
    'src/Bad.stories.tsx:1 Error default-exports',
    'src/Bad.stories.tsx:1 Warning prefer-pascal-case',
    'src/Bad.stories.tsx:2 Warning no-redundant-story-name',
  ])
})
