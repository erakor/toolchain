// Resolves the shared knip config through the package export, the way a consumer does.
import base from '@erakor/toolchain/knip'

export const config: { ignoreIssues: Record<string, string[]> } = { ...base }
