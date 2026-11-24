// Resolves the shadcn knip config through the package export, the way a consumer does.
import base from '@erakor/toolchain/knip/shadcn'

export const config: { ignoreIssues: Record<string, string[]> } = { ...base }
