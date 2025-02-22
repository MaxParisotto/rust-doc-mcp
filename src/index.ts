#!/usr/bin/env node
// @ts-nocheck
/// <reference types="node" />
import axios from "axios";
import { parse } from "toml";
import fs from "fs/promises";
import path from "path";
import * as pdfjsLib from "pdfjs-dist";
import { JSDOM } from "jsdom";
import { DocumentationDB } from "./db.js";
import { DocFetcher } from "./docFetcher.js";
import { BaseServer } from "./server.js";
import { McpError, ErrorCodes } from "./types.js";

const CRATES_IO_URL = "https://crates.io/api/v1/crates";

/**
 * RustDocServer is the main MCP server for fetching and analyzing Rust documentation.
 */
export class RustDocServer extends BaseServer {
  private db: DocumentationDB;
  private docFetcher: DocFetcher;
  private cachedManual?: Buffer;
  private startTime: number;

  constructor() {
    // Ensure the shebang is at the very start with no preceding whitespace.
    super({
      name: "rust-doc-mcp",
      version: "0.1.0",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      }
    });
    this.startTime = Date.now();
    this.db = DocumentationDB.getInstance();
    this.docFetcher = new DocFetcher();
    this.setupHandlers();
    this.initialize();
  }

  /**
   * Logs informational messages.
   * @param message The message to log.
   */
  private log_info(message: string): void {
    console.error(`[INFO] ${message}`);
  }

  /**
   * Logs error messages and prints the full error stack if available.
   * @param message The error message.
   * @param error Optional error object.
   */
  private log_error(message: string, error?: any): void {
    if (error && error.stack) {
      console.error(`[ERROR] ${message}\n${error.stack}`);
    } else {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  /**
   * Initializes the documentation database.
   */
  private async initialize(): Promise<void> {
    try {
      await this.db.initialize();
    } catch (error) {
      this.log_error("Failed to initialize the database", error);
      throw error;
    }
  }

  /**
   * Sets up the MCP handler functions for different tool invocations.
   */
  private setupHandlers(): void {
    // Register tool-related methods.
    this.registerHandler("list_tools", async () => ({
      tools: this.getTools()
    }));

    this.registerHandler("call_tool", async (params: any) => {
      if (!params.name) {
        throw new McpError(ErrorCodes.InvalidParams, "Tool name is required");
      }
      return await this.callTool(params.name, params.arguments || {});
    });
  }

  /**
   * Returns the list of available tools.
   */
  private getTools(): any[] {
    return [
      {
        name: "fetch_rust_manual",
        description: "Fetch latest stable Rust manual",
        inputSchema: { type: "object" }
      },
      {
        name: "analyze_cargo_toml",
        description: "Analyze project dependencies from Cargo.toml",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" }
          },
          required: ["path"]
        }
      },
      {
        name: "suggest_improvements",
        description: "Suggest documentation improvements based on code context",
        inputSchema: {
          type: "object",
          properties: {
            code_snippet: { type: "string" }
          },
          required: ["code_snippet"]
        }
      },
      {
        name: "search_rust_manual",
        description: "Search the Rust manual for a specific query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" }
          },
          required: ["query"]
        }
      },
      {
        name: "fetch_tauri_docs",
        description: "Fetch Tauri documentation",
        inputSchema: { type: "object" }
      },
      {
        name: "fetch_leptos_docs",
        description: "Fetch Leptos documentation",
        inputSchema: { type: "object" }
      },
      {
        name: "search_offline_docs",
        description: "Search the offline documentation database",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            framework: { type: "string", enum: ["leptos", "tauri"] }
          },
          required: ["query"]
        }
      },
      {
        name: "get_common_patterns",
        description: "Get common code patterns for a framework",
        inputSchema: {
          type: "object",
          properties: {
            framework: { type: "string", enum: ["leptos", "tauri"] }
          },
          required: ["framework"]
        }
      },
      {
        name: "find_error_solution",
        description: "Find solution for a common error",
        inputSchema: {
          type: "object",
          properties: {
            error: { type: "string" },
            framework: { type: "string", enum: ["leptos", "tauri"] }
          },
          required: ["error"]
        }
      },
      {
        name: "get_server_status",
        description: "Get current server status including uptime",
        inputSchema: { type: "object" }
      }
    ];
  }

  /**
   * Calls a tool based on its name and arguments.
   * @param name Name of the tool.
   * @param args Arguments for the tool.
   * @returns Result of the tool call.
   */
  private async callTool(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case "fetch_rust_manual":
          return await this.fetchManual();
        case "analyze_cargo_toml":
          if (!args.path) {
            throw new McpError(ErrorCodes.InvalidParams, "Path parameter required");
          }
          return await this.analyzeCargoToml(args.path);
        case "suggest_improvements":
          if (!args.code_snippet) {
            throw new McpError(ErrorCodes.InvalidParams, "Code snippet required");
          }
          return await this.generateSuggestions(args.code_snippet);
        case "search_rust_manual":
          if (!args.query) {
            throw new McpError(ErrorCodes.InvalidParams, "Query parameter required");
          }
          return await this.searchManual(args.query);
        case "fetch_tauri_docs":
          await this.docFetcher.fetchTauriDocs();
          return {
            content: [
              {
                type: "text",
                text: "Tauri documentation fetched and stored successfully"
              }
            ]
          };
        case "fetch_leptos_docs":
          await this.docFetcher.fetchLeptosDocs();
          return {
            content: [
              {
                type: "text",
                text: "Leptos documentation fetched and stored successfully"
              }
            ]
          };
        case "search_offline_docs":
          if (!args.query) {
            throw new McpError(ErrorCodes.InvalidParams, "Query parameter required");
          }
          const results = await this.db.searchDocs(args.query, args.framework);
          return {
            content: [
              {
                type: "text",
                text: this.formatSearchResults(results)
              }
            ]
          };
        case "get_common_patterns":
          if (!args.framework) {
            throw new McpError(ErrorCodes.InvalidParams, "Framework parameter required");
          }
          const patterns = await this.db.getPatternsByFramework(args.framework);
          return {
            content: [
              {
                type: "text",
                text: this.formatPatterns(patterns)
              }
            ]
          };
        case "find_error_solution":
          if (!args.error) {
            throw new McpError(ErrorCodes.InvalidParams, "Error parameter required");
          }
          const solutions = await this.db.findErrorSolutions(args.error);
          return {
            content: [
              {
                type: "text",
                text: this.formatErrorSolutions(solutions)
              }
            ]
          };
        case "get_server_status":
          return this.getServerStatus();
        default:
          throw new McpError(ErrorCodes.MethodNotFound, "Invalid tool");
      }
    } catch (error) {
      this.log_error(`Error in tool ${name}`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Fetches the Rust manual from the official documentation.
   * @returns Result indicating success or error.
   */
  private async fetchManual(): Promise<any> {
    try {
      const response = await axios.get("https://doc.rust-lang.org/stable/book/", { responseType: "text" });
      return {
        content: [
          {
            type: "text",
            text: "Rust manual fetched successfully"
          }
        ]
      };
    } catch (error) {
      this.log_error("Error fetching Rust manual", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch Rust manual: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Searches the Rust manual for the given query string.
   * @param query The search query.
   * @returns Search results or an error message.
   */
  private async searchManual(query: string): Promise<any> {
    try {
      const response = await axios.get("https://doc.rust-lang.org/stable/book/", { responseType: "text" });
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      const searchResults = Array.from(document.querySelectorAll("*"))
        .filter((element: Element) => element.textContent?.toLowerCase().includes(query.toLowerCase()))
        .map((element: Element) => element.textContent?.trim())
        .filter((text: string | undefined): text is string => text !== undefined && text.length > 20);
      return {
        content: [
          {
            type: "text",
            text:
              searchResults.length > 0
                ? searchResults.join("\n---\n")
                : "No results found in the Rust manual."
          }
        ]
      };
    } catch (error) {
      this.log_error("Error searching manual", error);
      return {
        content: [
          {
            type: "text",
            text: `Error searching manual: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Formats search results for display.
   * @param results Array of search results.
   * @returns A formatted string of search results.
   */
  private formatSearchResults(results: any[]): string {
    if (results.length === 0) return "No matching documentation found.";
    return results
      .map(result => {
        let output = `Title: ${result.title}\n`;
        output += `Category: ${result.category}\n`;
        output += `Framework: ${result.framework}\n`;
        output += `Content:\n${result.content}\n`;
        if (result.examples?.length > 0) {
          output += "\nExamples:\n";
          result.examples.forEach((example: string, index: number) => {
            output += `${index + 1}. ${example}\n`;
          });
        }
        return output;
      })
      .join("\n---\n");
  }

  /**
   * Formats common code patterns for display.
   * @param patterns Array of pattern objects.
   * @returns A formatted string of patterns.
   */
  private formatPatterns(patterns: any[]): string {
    if (patterns.length === 0) return "No patterns found.";
    return patterns
      .map(pattern => {
        let output = `Pattern: ${pattern.name}\n`;
        output += `Description: ${pattern.description}\n`;
        output += `Category: ${pattern.category}\n`;
        output += "Template:\n```rust\n";
        output += pattern.code_template;
        output += "\n```";
        return output;
      })
      .join("\n---\n");
  }

  /**
   * Formats error solutions for display.
   * @param solutions Array of error solution objects.
   * @returns A formatted string of error solutions.
   */
  private formatErrorSolutions(solutions: any[]): string {
    if (solutions.length === 0) return "No solutions found for this error.";
    return solutions
      .map(solution => {
        let output = `Error: ${solution.error_pattern}\n`;
        output += `Solution: ${solution.solution}\n`;
        if (solution.example_fix) {
          output += "Example Fix:\n```rust\n";
          output += solution.example_fix;
          output += "\n```";
        }
        return output;
      })
      .join("\n---\n");
  }

  /**
   * Analyzes a Cargo.toml file, extracts dependencies, and provides detailed information.
   * @param projectPath The path to the project directory.
   * @returns Detailed dependency information.
   * @throws McpError if processing fails.
   */
  private async analyzeCargoToml(projectPath: string): Promise<any> {
    const fullProjectPath = path.resolve(projectPath);
    try {
      const stats = await fs.stat(fullProjectPath);
      if (!stats.isDirectory()) {
        throw new McpError(ErrorCodes.InvalidParams, `Provided path is not a directory: ${projectPath}`);
      }
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new McpError(ErrorCodes.InvalidParams, `Project directory not found: ${projectPath}`);
      }
      throw error;
    }
    const cargoPath = path.join(fullProjectPath, "Cargo.toml");
    const cargoLockPath = path.join(fullProjectPath, "Cargo.lock");
    try {
      const tomlContent = await fs.readFile(cargoPath, "utf-8");
      const parsed = parse(tomlContent);
      const dependencyInfo: any = {};

      // Helper function to process dependencies.
      const processDependencies = async (dependencies: any, section: string): Promise<void> => {
        if (!dependencies) return;
        for (const [crate, versionInfo] of Object.entries(dependencies)) {
          let version = typeof versionInfo === "string" ? versionInfo : (versionInfo as any).version;
          const cleanVersion = version.replace(/[\^~=]/g, "");
          try {
            const response = await axios.get(`${CRATES_IO_URL}/${crate}`);
            const crateInfo = response.data.crate;
            const latestVersion = crateInfo.max_stable_version || crateInfo.max_version;
            dependencyInfo[`${section}:${crate}`] = {
              currentVersion: version,
              latestVersion,
              description: crateInfo.description,
              outdated: cleanVersion !== latestVersion
            };
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              dependencyInfo[`${section}:${crate}`] = {
                currentVersion: version,
                latestVersion: "Not Found",
                description: "Crate not found on crates.io",
                outdated: false
              };
            } else {
              this.log_error(`Error fetching crate info for ${crate}`, error);
              dependencyInfo[`${section}:${crate}`] = {
                currentVersion: version,
                latestVersion: "Error",
                description: "Error fetching crate information",
                outdated: false
              };
            }
          }
        }
      };

      await processDependencies(parsed.dependencies, "dependencies");
      await processDependencies(parsed["dev-dependencies"], "dev-dependencies");
      await processDependencies(parsed["build-dependencies"], "build-dependencies");

      const output = Object.entries(dependencyInfo)
        .map(([key, info]: [string, any]) => {
          const [section, crate] = key.split(":");
          return `[${section}] ${crate}:\n  Current: ${info.currentVersion}\n  Latest: ${info.latestVersion}\n  Outdated: ${info.outdated}\n  Description: ${info.description}`;
        })
        .join("\n\n");

      let additionalMessage = "";
      try {
        await fs.access(cargoLockPath);
      } catch {
        additionalMessage = "\n\nNote: 'Cargo.lock' file not found. Consider running `cargo build` to generate it for better dependency analysis and linting.";
      }
      return {
        content: [
          {
            type: "text",
            text: output + additionalMessage
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new McpError(ErrorCodes.InvalidParams, `'Cargo.toml' not found in project directory: ${projectPath}`);
      }
      throw new McpError(ErrorCodes.InternalError, `Error parsing 'Cargo.toml': ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Suggests documentation improvements based on the provided code snippet.
   * @param code A code snippet to analyze.
   * @returns Documentation suggestions.
   */
  private async generateSuggestions(code: string): Promise<any> {
    const crateRegex = /(?:use\s+([\w:]+)(?:\s*::\s*\{[^}]*\})?)|(?:([\w]+)::([\w:]+))/g;
    const potentialCrates = new Set<string>();
    let match;
    while ((match = crateRegex.exec(code)) !== null) {
      if (match[1]) {
        const parts = match[1].split("::");
        potentialCrates.add(parts[0]);
      } else if (match[2] && match[3]) {
        potentialCrates.add(match[2]);
      }
    }
    const crateData: any[] = [];
    for (const crate of potentialCrates) {
      try {
        const response = await axios.get(`${CRATES_IO_URL}/${crate}`);
        const crateInfo = response.data.crate;
        let item = "";
        crateRegex.lastIndex = 0;
        while ((match = crateRegex.exec(code)) !== null) {
          if (match[1] && match[1].startsWith(crate)) {
            const parts = match[1].split("::");
            if (parts.length > 1) {
              item = parts[parts.length - 1];
            }
          } else if (match[2] === crate && match[3]) {
            item = match[3];
          }
        }
        crateData.push({
          name: crateInfo.name,
          documentation: crateInfo.documentation,
          description: crateInfo.description,
          item: item
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // Ignore missing crates.
        } else {
          this.log_error(`Error fetching crate info for ${crate}`, error);
        }
      }
    }
    if (crateData.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No documentation found for the crates used in the code snippet."
          }
        ]
      };
    }
    return {
      content: [
        {
          type: "text",
          text: "Documentation suggestions:\n" + crateData
            .map((c) => "- " + c.name + (c.item ? "::" + c.item : "") + ": " + (c.documentation || "No documentation URL found.") + " (" + (c.description || "No description") + ")")
            .join("\n")
        }
      ]
    };
  }

  /**
   * Returns the current server status, including uptime.
   * @returns Server status information.
   */
  private getServerStatus(): any {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      content: [
        {
          type: "text",
          text: `Server is running. Uptime: ${uptimeSeconds} seconds.`
        }
      ]
    };
  }

  /**
   * Runs self tests if in test mode to verify core functionality.
   */
  private async runSelfTests(): Promise<void> {
    this.log_info("Running self tests...");
    try {
      const manualResult = await this.fetchManual();
      const statusResult = this.getServerStatus();
      this.log_info("Self tests completed successfully.");
      this.log_info("Fetch manual result: " + JSON.stringify(manualResult));
      this.log_info("Server status: " + JSON.stringify(statusResult));
    } catch (error) {
      this.log_error("Self tests failed", error);
    }
  }

  /**
   * Starts the server, sends an initialization notification, sets up a heartbeat, and runs self tests in test mode.
   */
    async start(): Promise<void> {
      await super.start();
      await this.sendNotification("initialized", {
        protocolVersion: this.serverInfo.protocolVersion,
        capabilities: this.serverInfo.capabilities,
        serverInfo: { name: this.serverInfo.name, version: this.serverInfo.version }
      });
      this.log_info("Listening for MCP requests on STDIN");
      // Send heartbeat every 30 seconds to maintain connection.
      setInterval(() => {
        this.sendNotification("heartbeat", { timestamp: Date.now() });
      }, 30000);
      // Run self tests if in test mode.
      if (process.env.NODE_ENV === "test") {
        await this.runSelfTests();
      }
      this.log_info("Rust Doc MCP server running");
    }
}

const server = new RustDocServer();
server.start().catch((error) => {
  console.error("Server failed to start:", error);
});
