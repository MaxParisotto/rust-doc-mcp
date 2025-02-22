#!/usr/bin/env node
import { BaseServer } from "./server.js";
/**
 * RustDocServer is the main MCP server for fetching and analyzing Rust documentation.
 */
export declare class RustDocServer extends BaseServer {
    private db;
    private docFetcher;
    private cachedManual?;
    private startTime;
    constructor();
    /**
     * Logs informational messages.
     * @param message The message to log.
     */
    private log_info;
    /**
     * Logs error messages and prints the full error stack if available.
     * @param message The error message.
     * @param error Optional error object.
     */
    private log_error;
    /**
     * Initializes the documentation database.
     */
    private initialize;
    /**
     * Sets up the MCP handler functions for different tool invocations.
     */
    private setupHandlers;
    /**
     * Returns the list of available tools.
     */
    private getTools;
    /**
     * Calls a tool based on its name and arguments.
     * @param name Name of the tool.
     * @param args Arguments for the tool.
     * @returns Result of the tool call.
     */
    private callTool;
    /**
     * Fetches the Rust manual from the official documentation.
     * @returns Result indicating success or error.
     */
    private fetchManual;
    /**
     * Searches the Rust manual for the given query string.
     * @param query The search query.
     * @returns Search results or an error message.
     */
    private searchManual;
    /**
     * Formats search results for display.
     * @param results Array of search results.
     * @returns A formatted string of search results.
     */
    private formatSearchResults;
    /**
     * Formats common code patterns for display.
     * @param patterns Array of pattern objects.
     * @returns A formatted string of patterns.
     */
    private formatPatterns;
    /**
     * Formats error solutions for display.
     * @param solutions Array of error solution objects.
     * @returns A formatted string of error solutions.
     */
    private formatErrorSolutions;
    /**
     * Analyzes a Cargo.toml file, extracts dependencies, and provides detailed information.
     * @param projectPath The path to the project directory.
     * @returns Detailed dependency information.
     * @throws McpError if processing fails.
     */
    private analyzeCargoToml;
    /**
     * Suggests documentation improvements based on the provided code snippet.
     * @param code A code snippet to analyze.
     * @returns Documentation suggestions.
     */
    private generateSuggestions;
    /**
     * Returns the current server status, including uptime.
     * @returns Server status information.
     */
    private getServerStatus;
    /**
     * Runs self tests if in test mode to verify core functionality.
     */
    private runSelfTests;
    /**
     * Starts the server, sends an initialization notification, sets up a heartbeat, and runs self tests in test mode.
     */
    start(): Promise<void>;
}
