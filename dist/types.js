export class McpError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'McpError';
    }
}
export const ErrorCodes = {
    ParseError: -32700,
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603,
};
//# sourceMappingURL=types.js.map