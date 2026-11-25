// Resolves the Storybook knip config through the package export, the way a consumer does.
import shadcn from '@erakor/toolchain/knip/shadcn'
import storybook from '@erakor/toolchain/knip/storybook'

export const config: {
  ignoreIssues: Record<string, string[]>
  ignoreDependencies: string[]
} = { ...shadcn, ...storybook }
