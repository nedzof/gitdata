/**
 * Audit logger middleware: logs one JSON line per request with basic fields.
 * Fields: ts, ip, method, path, status, ms, ua
 */
export declare function auditLogger(): (req: any, res: any, next: any) => void;
