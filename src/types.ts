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

export class McpError extends Error {
    constructor(public code: number, message: string) {
        super(message);
        this.name = 'McpError';
    }
}

export const ErrorCodes = {
    ParseError: -32700,
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603,
} as const;
