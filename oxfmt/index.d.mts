import type { OxfmtConfig } from 'oxfmt'

declare const base: OxfmtConfig

export declare function tailwind(stylesheet: string): NonNullable<OxfmtConfig['sortTailwindcss']>

export default base
