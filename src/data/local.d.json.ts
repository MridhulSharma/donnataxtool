/**
 * Type declaration for the generated data payload (allowArbitraryExtensions).
 * Declaring the shape here keeps tsc from inferring a literal type for a
 * ~830KB JSON file, which is both slow and useless.
 *
 * Regenerate the data itself with `npm run data`.
 */
import type { CompactRow } from '../lib/types'

declare const rows: CompactRow[]
export default rows
