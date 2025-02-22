import { McpServer } from './types.js';
export declare class BaseServer {
    private serverInfo;
    private requestHandlers;
    private nextRequestId;
    constructor(serverInfo: McpServer);
    protected registerHandler(method: string, handler: (params: any) => Promise<any>): void;
    private handleRequest;
    start(): Promise<void>;
    protected sendNotification(method: string, params: any): Promise<void>;
    protected sendRequest(method: string, params: any): Promise<any>;
}
