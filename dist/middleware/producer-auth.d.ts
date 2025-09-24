/**
 * Producer authentication and authorization middleware
 */
import type { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            producer?: {
                privateKey: string;
                publicKey: string;
                producerId: string;
            };
        }
    }
}
/**
 * Authenticate producer using API key or signature
 */
export declare function authenticateProducer(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Validate that producer has permissions for the stream
 */
export declare function validateStreamPermissions(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Generate API key for development
 */
export declare function generateApiKey(credentials: any): string;
/**
 * Create signature for request (helper for client SDKs)
 */
export declare function createSignature(privateKey: string, timestamp: number, method: string, path: string, body: any): string;
