import axios from 'axios';
import { DocumentationDB } from './db.js';
import { Octokit } from '@octokit/rest';
import { DocsRsParser } from './parsers/docsRsParser.js';
import { AwesomeLeptosParser } from './parsers/awesomeLeptosParser.js';
export class DocFetcher {
    constructor() {
        this.db = DocumentationDB.getInstance();
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
    }
    async fetchLeptosDocs() {
        try {
            // Fetch and parse official docs
            console.log('Fetching Leptos docs from docs.rs...');
            const officialDocs = await axios.get('https://docs.rs/leptos/latest/leptos/');
            console.log('Response status:', officialDocs.status);
            console.log('Response data preview:', officialDocs.data.slice(0, 500));
            console.log('Parsing Leptos documentation...');
            const docsItems = await DocsRsParser.parse(officialDocs.data, 'leptos', 'latest');
            console.log('Parsed items count:', docsItems.length);
            console.log('First item preview:', docsItems[0]);
            // Store official documentation
            for (const item of docsItems) {
                await this.db.addDocument(item);
            }
            // Fetch and parse awesome-leptos examples
            const { data: awesomeLeptos } = await this.octokit.repos.getContent({
                owner: 'leptos-rs',
                repo: 'awesome-leptos',
                path: 'README.md'
            });
            if ('content' in awesomeLeptos) {
                const content = Buffer.from(awesomeLeptos.content, 'base64').toString();
                // Parse awesome-leptos content
                const communityItems = await AwesomeLeptosParser.parse(content);
                for (const item of communityItems) {
                    await this.db.addDocument(item);
                }
                // Extract and store patterns
                const patterns = await AwesomeLeptosParser.extractPatterns(communityItems);
                for (const pattern of patterns) {
                    await this.db.addDocument(pattern);
                }
            }
            // Fetch and store error patterns
            await this.fetchErrorPatterns();
        }
        catch (error) {
            console.error('Error fetching Leptos docs:', error);
            throw error;
        }
    }
    async fetchTauriDocs() {
        try {
            // Fetch official Tauri docs
            const officialDocs = await axios.get('https://tauri.app/v1/api/js');
            const docsItems = await DocsRsParser.parse(officialDocs.data, 'tauri', 'v1');
            // Store official documentation
            for (const item of docsItems) {
                await this.db.addDocument(item);
            }
            // Fetch and store error patterns
            await this.fetchErrorPatterns();
            // Fetch and store integration patterns
            await this.fetchIntegrationPatterns();
        }
        catch (error) {
            console.error('Error fetching Tauri docs:', error);
            throw error;
        }
    }
    async fetchErrorPatterns() {
        try {
            // Fetch error patterns from GitHub issues
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: 'leptos-rs',
                repo: 'leptos',
                state: 'closed',
                labels: 'bug',
                per_page: 100
            });
            for (const issue of issues) {
                if (issue.body?.includes('error[')) {
                    const errorMatch = issue.body.match(/error\[(E\d+)\]:(.*?)(?=\n|$)/);
                    if (errorMatch) {
                        const [, code, message] = errorMatch;
                        const solution = this.extractSolutionFromIssue(issue.body);
                        if (solution) {
                            await this.db.addErrorSolution({
                                error_pattern: `${code}: ${message.trim()}`,
                                solution: solution.description,
                                example_fix: solution.code,
                                framework: 'leptos'
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error fetching error patterns:', error);
        }
    }
    extractSolutionFromIssue(body) {
        // Look for solution in comments marked with "Solution:" or "Fix:"
        const solutionMatch = body.match(/(?:Solution|Fix):\s*((?:(?!\n\n).)*(?:\n(?!\n).*)*)/s);
        if (!solutionMatch)
            return null;
        const solution = solutionMatch[1];
        const codeMatch = solution.match(/```(?:rust)?\n([\s\S]*?)\n```/);
        return {
            description: solution.replace(/```(?:rust)?\n[\s\S]*?\n```/g, '').trim(),
            code: codeMatch ? codeMatch[1].trim() : undefined
        };
    }
    async fetchIntegrationPatterns() {
        try {
            // Fetch integration examples from Tauri + Leptos repositories
            const { data: repos } = await this.octokit.search.repos({
                q: 'tauri leptos in:name,description,readme',
                sort: 'stars',
                order: 'desc',
                per_page: 10
            });
            for (const repo of repos.items) {
                if (!repo.owner?.login || !repo.name)
                    continue;
                try {
                    // Get the repository's README
                    const { data: readme } = await this.octokit.repos.getReadme({
                        owner: repo.owner.login,
                        repo: repo.name
                    });
                    if ('content' in readme) {
                        const content = Buffer.from(readme.content, 'base64').toString();
                        // Look for integration patterns in the README
                        const patterns = this.extractIntegrationPatterns(content);
                        for (const pattern of patterns) {
                            await this.db.addPattern({
                                name: pattern.name,
                                description: pattern.description,
                                code_template: pattern.code,
                                framework: 'integration',
                                category: 'tauri-leptos'
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing repo ${repo.full_name}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Error fetching integration patterns:', error);
        }
    }
    extractIntegrationPatterns(content) {
        const patterns = [];
        // Look for code blocks with comments describing patterns
        const codeBlockRegex = /```(?:rust)?\n([\s\S]*?)\n```/g;
        let match;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            const code = match[1];
            const precedingText = content.slice(0, match.index).split('\n').slice(-3).join('\n');
            // Look for pattern descriptions in preceding text
            const titleMatch = precedingText.match(/#+\s*(.*?)(?:\n|$)/);
            const descMatch = precedingText.match(/(?:Pattern|Example):\s*(.*?)(?:\n|$)/i);
            if (titleMatch || descMatch) {
                patterns.push({
                    name: titleMatch ? titleMatch[1].trim() : 'Integration Pattern',
                    description: descMatch ? descMatch[1].trim() : 'Integration example between Tauri and Leptos',
                    code: code.trim()
                });
            }
        }
        return patterns;
    }
}
//# sourceMappingURL=docFetcher.js.map