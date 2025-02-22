export interface DocItem {
    id?: number;
    crate: string;
    version: string;
    title: string;
    content: string;
    category: string;
    framework: string;
    tags: string[];
    examples: string[];
    created_at: Date;
    updated_at: Date;
}
export declare class DocumentationDB {
    private db;
    private static instance;
    private constructor();
    static getInstance(): DocumentationDB;
    initialize(): Promise<void>;
    private createTables;
    addDocument(doc: DocItem): Promise<number>;
    searchDocs(query: string, framework?: string): Promise<DocItem[]>;
    addPattern(pattern: {
        name: string;
        description: string;
        code_template: string;
        framework: string;
        category: string;
    }): Promise<void>;
    addErrorSolution(solution: {
        error_pattern: string;
        solution: string;
        example_fix?: string;
        framework?: string;
    }): Promise<void>;
    findErrorSolutions(error: string): Promise<any[]>;
    getPatternsByFramework(framework: string): Promise<any[]>;
}
