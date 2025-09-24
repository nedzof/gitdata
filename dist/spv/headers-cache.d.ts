import { type HeadersIndex } from './verify-envelope';
/**
 * Get a headers snapshot with simple TTL + mtime invalidation.
 * If the file's mtime changes or TTL expires, reload via loadHeaders().
 */
export declare function getHeadersSnapshot(headersFile: string): HeadersIndex;
/** Force invalidate the memoized headers snapshot (used in tests if needed) */
export declare function invalidateHeadersSnapshot(): void;
