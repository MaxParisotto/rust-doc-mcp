export interface McpRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params: any;
}
export interface McpResponse {
    jsonrpc: '2.0';
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export interface McpServer {
    name: string;
    version: string;
    capabilities: {
        tools?: Record<string, unknown>;
        resources?: Record<string, unknown>;
    };
}
export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export declare class McpError extends Error {
    code: number;
    constructor(code: number, message: string);
}
export declare const ErrorCodes: {
    readonly ParseError: -32700;
    readonly InvalidRequest: -32600;
    readonly MethodNotFound: -32601;
    readonly InvalidParams: -32602;
    readonly InternalError: -32603;
};
