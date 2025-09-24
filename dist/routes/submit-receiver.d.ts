import type { Router } from 'express';
export declare function submitReceiverRouter(opts: {
    headersFile: string;
    minConfs: number;
    bodyMaxSize: number;
}): Router;
export declare function submitReceiverRouterWrapper(): Router;
