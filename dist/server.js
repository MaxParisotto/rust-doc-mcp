import { McpError, ErrorCodes } from './types.js';
import { createInterface } from 'readline';
export class BaseServer {
    constructor(serverInfo) {
        this.serverInfo = serverInfo;
        this.requestHandlers = new Map();
        this.nextRequestId = 1;
    }
    registerHandler(method, handler) {
        this.requestHandlers.set(method, handler);
    }
    async handleRequest(request) {
        try {
            const handler = this.requestHandlers.get(request.method);
            if (!handler) {
                throw new McpError(ErrorCodes.MethodNotFound, `Method not found: ${request.method}`);
            }
            const result = await handler(request.params);
            return {
                jsonrpc: '2.0',
                id: request.id,
                result
            };
        }
        catch (error) {
            if (error instanceof McpError) {
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                        code: error.code,
                        message: error.message
                    }
                };
            }
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: ErrorCodes.InternalError,
                    message: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
    async start() {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });
        // Register basic MCP methods
        this.registerHandler('initialize', async () => ({
            protocolVersion: this.serverInfo.protocolVersion,
            capabilities: this.serverInfo.capabilities,
            serverInfo: { name: this.serverInfo.name, version: this.serverInfo.version }
        }));
        this.registerHandler('shutdown', async () => {
            setTimeout(() => process.exit(0), 100);
            return null;
        });
        rl.on('line', async (line) => {
            try {
                const request = JSON.parse(line);
                const response = await this.handleRequest(request);
                console.log(JSON.stringify(response));
            }
            catch (error) {
                console.log(JSON.stringify({
                    jsonrpc: '2.0',
                    id: this.nextRequestId++,
                    error: {
                        code: ErrorCodes.ParseError,
                        message: 'Parse error'
                    }
                }));
            }
        });
        console.error('MCP server started');
    }
    async sendNotification(method, params) {
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            method,
            params
        }));
    }
    async sendRequest(method, params) {
        const id = this.nextRequestId++;
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params
        }));
        // Note: In a real implementation, we would wait for the response
        // but for our purposes, we'll just send the request
        return null;
    }
}
//# sourceMappingURL=server.js.map