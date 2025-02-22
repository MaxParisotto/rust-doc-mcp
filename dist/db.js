import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
export class DocumentationDB {
    constructor() {
        this.db = null;
    }
    static getInstance() {
        if (!DocumentationDB.instance) {
            DocumentationDB.instance = new DocumentationDB();
        }
        return DocumentationDB.instance;
    }
    async initialize() {
        const dbPath = path.join(process.cwd(), 'rust_docs.db');
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        await this.createTables();
    }
    async createTables() {
        if (!this.db)
            throw new Error('Database not initialized');
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS documentation (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crate TEXT NOT NULL,
                version TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                framework TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER,
                tag TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documentation(id)
            );

            CREATE TABLE IF NOT EXISTS examples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER,
                code TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY (doc_id) REFERENCES documentation(id)
            );

            CREATE TABLE IF NOT EXISTS patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                code_template TEXT NOT NULL,
                framework TEXT NOT NULL,
                category TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS error_solutions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_pattern TEXT NOT NULL,
                solution TEXT NOT NULL,
                example_fix TEXT,
                framework TEXT
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS documentation_fts USING fts5(
                title, content, category, framework,
                content='documentation',
                content_rowid='id'
            );
        `);
    }
    async addDocument(doc) {
        if (!this.db)
            throw new Error('Database not initialized');
        const result = await this.db.run(`INSERT INTO documentation 
            (crate, version, title, content, category, framework, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [doc.crate, doc.version, doc.title, doc.content, doc.category, doc.framework]);
        const docId = result.lastID;
        // Add tags
        for (const tag of doc.tags) {
            await this.db.run('INSERT INTO tags (doc_id, tag) VALUES (?, ?)', [docId, tag]);
        }
        // Add examples
        for (const example of doc.examples) {
            await this.db.run('INSERT INTO examples (doc_id, code) VALUES (?, ?)', [docId, example]);
        }
        // Update FTS table
        await this.db.run(`INSERT INTO documentation_fts (rowid, title, content, category, framework)
            SELECT id, title, content, category, framework FROM documentation WHERE id = ?`, [docId]);
        return docId;
    }
    async searchDocs(query, framework) {
        if (!this.db)
            throw new Error('Database not initialized');
        const frameworkFilter = framework ? 'AND framework = ?' : '';
        const params = framework ? [query, framework] : [query];
        const docs = await this.db.all(`
            SELECT d.*, GROUP_CONCAT(DISTINCT t.tag) as tags, GROUP_CONCAT(DISTINCT e.code) as examples
            FROM documentation_fts fts
            JOIN documentation d ON fts.rowid = d.id
            LEFT JOIN tags t ON d.id = t.doc_id
            LEFT JOIN examples e ON d.id = e.doc_id
            WHERE documentation_fts MATCH ?
            ${frameworkFilter}
            GROUP BY d.id
            ORDER BY rank
        `, params);
        return docs.map(row => ({
            ...row,
            tags: row.tags ? row.tags.split(',') : [],
            examples: row.examples ? row.examples.split(',') : [],
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        }));
    }
    async addPattern(pattern) {
        if (!this.db)
            throw new Error('Database not initialized');
        await this.db.run(`INSERT INTO patterns 
            (name, description, code_template, framework, category)
            VALUES (?, ?, ?, ?, ?)`, [pattern.name, pattern.description, pattern.code_template, pattern.framework, pattern.category]);
    }
    async addErrorSolution(solution) {
        if (!this.db)
            throw new Error('Database not initialized');
        await this.db.run(`INSERT INTO error_solutions 
            (error_pattern, solution, example_fix, framework)
            VALUES (?, ?, ?, ?)`, [solution.error_pattern, solution.solution, solution.example_fix, solution.framework]);
    }
    async findErrorSolutions(error) {
        if (!this.db)
            throw new Error('Database not initialized');
        return await this.db.all(`SELECT * FROM error_solutions 
            WHERE error_pattern LIKE ?`, [`%${error}%`]);
    }
    async getPatternsByFramework(framework) {
        if (!this.db)
            throw new Error('Database not initialized');
        return await this.db.all(`SELECT * FROM patterns 
            WHERE framework = ?`, [framework]);
    }
}
//# sourceMappingURL=db.js.map