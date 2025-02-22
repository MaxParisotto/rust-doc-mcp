import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
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
        try {
            // Create a dedicated data directory for the database.
            const dbDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
            await fs.mkdir(dbDir, { recursive: true });
            const dbPath = path.join(dbDir, 'rust_docs.db');
            await fs.access(dbDir, (await import('fs')).constants.W_OK);
            console.log('Initializing database at:', dbPath);
            // Delete existing database to start fresh
            try {
                await fs.unlink(dbPath);
                console.log('Removed existing database');
            }
            catch (error) {
                // Ignore if file doesn't exist
            }
            this.db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });
            await this.createTables();
            console.log('Database initialized successfully');
        }
        catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
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
                title, content, category, framework, tags, examples,
                content='documentation',
                content_rowid='id',
                tokenize='porter unicode61 remove_diacritics 2'
            );

            CREATE TRIGGER IF NOT EXISTS documentation_ai AFTER INSERT ON documentation BEGIN
                INSERT INTO documentation_fts(
                    rowid,
                    title,
                    content,
                    category,
                    framework,
                    tags,
                    examples
                ) VALUES (
                    new.id,
                    new.title,
                    new.content,
                    new.category,
                    new.framework,
                    (SELECT GROUP_CONCAT(tag, ' ') FROM tags WHERE doc_id = new.id),
                    (SELECT GROUP_CONCAT(code, ' ') FROM examples WHERE doc_id = new.id)
                );
            END;
        `);
    }
    async addDocument(doc) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            console.log('Adding document:', doc.title);
            const result = await this.db.run(`INSERT INTO documentation 
                (crate, version, title, content, category, framework, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [doc.crate, doc.version, doc.title, doc.content, doc.category, doc.framework]);
            const docId = result.lastID;
            // Add tags
            for (const tag of doc.tags) {
                await this.db.run('INSERT INTO tags (doc_id, tag) VALUES (?, ?)', [docId, tag]);
            }
            // Add examples
            const examples = Array.isArray(doc.examples) ? doc.examples : [doc.examples];
            for (const example of examples) {
                if (example && example.trim()) {
                    await this.db.run('INSERT INTO examples (doc_id, code) VALUES (?, ?)', [docId, example]);
                }
            }
            return docId;
        }
        catch (error) {
            console.error('Error adding document:', error);
            throw error;
        }
    }
    async searchDocs(query, framework) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            console.log('Searching docs:', { query, framework });
            // First, check if we have any documents in FTS
            const ftsCount = await this.db.get('SELECT COUNT(*) as count FROM documentation_fts');
            console.log('FTS table count:', ftsCount);
            // Check raw documents
            const rawDocs = await this.db.all('SELECT * FROM documentation LIMIT 5');
            console.log('Sample documents:', rawDocs);
            // Build search query
            const searchTerms = query.split(' ').map(term => `"${term}"*`).join(' OR ');
            console.log('Search query:', searchTerms);
            const frameworkFilter = framework ? 'AND d.framework = ?' : '';
            const params = framework ? [searchTerms, framework] : [searchTerms];
            const docs = await this.db.all(`
                SELECT 
                    d.*,
                    GROUP_CONCAT(DISTINCT t.tag) as tags,
                    GROUP_CONCAT(DISTINCT e.code) as examples,
                    rank
                FROM documentation_fts fts
                JOIN documentation d ON fts.rowid = d.id
                LEFT JOIN tags t ON d.id = t.doc_id
                LEFT JOIN examples e ON d.id = e.doc_id
                WHERE documentation_fts MATCH ?
                ${frameworkFilter}
                GROUP BY d.id
                ORDER BY rank
            `, params);
            console.log('Search results:', docs.length);
            return docs.map(row => ({
                ...row,
                tags: row.tags ? row.tags.split(',') : [],
                examples: row.examples ? row.examples.split(',') : [],
                created_at: new Date(row.created_at),
                updated_at: new Date(row.updated_at)
            }));
        }
        catch (error) {
            console.error('Error searching docs:', error);
            throw error;
        }
    }
    async addPattern(pattern) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            await this.db.run(`INSERT INTO patterns 
                (name, description, code_template, framework, category)
                VALUES (?, ?, ?, ?, ?)`, [pattern.name, pattern.description, pattern.code_template, pattern.framework, pattern.category]);
        }
        catch (error) {
            console.error('Error adding pattern:', error);
            throw error;
        }
    }
    async addErrorSolution(solution) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            await this.db.run(`INSERT INTO error_solutions 
                (error_pattern, solution, example_fix, framework)
                VALUES (?, ?, ?, ?)`, [solution.error_pattern, solution.solution, solution.example_fix, solution.framework]);
        }
        catch (error) {
            console.error('Error adding error solution:', error);
            throw error;
        }
    }
    async findErrorSolutions(error) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            return await this.db.all(`SELECT * FROM error_solutions 
                WHERE error_pattern LIKE ?`, [`%${error}%`]);
        }
        catch (error) {
            console.error('Error finding error solutions:', error);
            throw error;
        }
    }
    async getPatternsByFramework(framework) {
        if (!this.db)
            throw new Error('Database not initialized');
        try {
            return await this.db.all(`SELECT * FROM patterns 
                WHERE framework = ?`, [framework]);
        }
        catch (error) {
            console.error('Error getting patterns:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=db.js.map