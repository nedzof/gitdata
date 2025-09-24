export declare function callAgentWebhook(url: string, body: any, fetchImpl?: typeof fetch, timeoutMs?: number): Promise<{
    status: number;
    body: any;
}>;
