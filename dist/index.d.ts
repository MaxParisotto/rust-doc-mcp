#!/usr/bin/env node
import { BaseServer } from './server.js';
export declare class RustDocServer extends BaseServer {
    private db;
    private docFetcher;
    private cachedManual?;
    constructor();
    private initialize;
    private setupHandlers;
    private getTools;
    private callTool;
    private fetchManual;
    private searchManual;
    private formatSearchResults;
    private formatPatterns;
    private formatErrorSolutions;
    /**
     * Analyzes a Cargo.toml file, extracts dependencies, and provides detailed information.
     * @param projectPath The path to the project directory.
     * @returns Detailed information about dependencies, including version, features, description, and update status.
     * @throws McpError if the path is invalid, Cargo.toml is not found, or parsing fails.
     */
    private analyzeCargoToml;
    /**
     * Suggests documentation improvements based on the provided code snippet.
     * @param code The code snippet to analyze.
     * @returns Documentation suggestions.
     * @note Always prioritize keeping the code linter error and warning-free.
     */
    private generateSuggestions;
    start(): Promise<void>;
}
