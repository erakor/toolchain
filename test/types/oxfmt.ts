// Resolves the shared config through the package export, the way a consumer does,
// so the `types` condition and oxfmt/index.d.mts are checked.
import type { OxfmtConfig } from 'oxfmt'

import base from '@erakor/toolchain/oxfmt'

export const config: OxfmtConfig = { ...base }
