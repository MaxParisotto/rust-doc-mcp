import { DocItem } from '../db.js';

interface RepoContent {
    title: string;
    description: string;
    url: string;
    category: string;
}

export class AwesomeLeptosParser {
    /**
     * Parses content from awesome-leptos README.md
     * @param content The markdown content from awesome-leptos repository
     * @returns Array of parsed documentation items
     */
    static async parse(content: string): Promise<DocItem[]> {
        const sections = this.parseSections(content);
        const items: DocItem[] = [];

        for (const section of sections) {
            const repos = this.parseRepos(section.content);
            
            // Create a section overview doc
            items.push({
                crate: 'leptos',
                version: 'latest',
                title: section.title,
                content: section.description,
                category: 'awesome-leptos',
                framework: 'leptos',
                tags: ['community', section.title.toLowerCase()],
                examples: [],
                created_at: new Date(),
                updated_at: new Date()
            });

            // Create docs for each repository
            for (const repo of repos) {
                items.push({
                    crate: 'leptos',
                    version: 'latest',
                    title: repo.title,
                    content: repo.description,
                    category: repo.category,
                    framework: 'leptos',
                    tags: ['community', 'example', repo.category],
                    examples: [repo.url],
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }

        return items;
    }

    private static parseSections(content: string): Array<{
        title: string;
        description: string;
        content: string;
    }> {
        const sections = content.split('\n## ').slice(1); // Skip the header
        return sections.map(section => {
            const [title, ...rest] = section.split('\n');
            const content = rest.join('\n');
            
            // Extract description (text before the first list item)
            const descriptionMatch = content.match(/^([^-\n]*)(?=-|$)/m);
            const description = descriptionMatch ? descriptionMatch[1].trim() : '';

            return {
                title: title.trim(),
                description,
                content
            };
        });
    }

    private static parseRepos(content: string): RepoContent[] {
        const repos: RepoContent[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // Match markdown links with descriptions
            const match = line.match(/^-\s*\[(.*?)\]\((.*?)\)(?:\s*-\s*(.*))?$/);
            if (match) {
                const [, title, url, description = ''] = match;
                repos.push({
                    title: title.trim(),
                    url: url.trim(),
                    description: description.trim(),
                    category: this.categorizeRepo(title, description)
                });
            }
        }

        return repos;
    }

    private static categorizeRepo(title: string, description: string): string {
        const text = `${title} ${description}`.toLowerCase();
        
        if (text.includes('example') || text.includes('demo')) return 'example';
        if (text.includes('tutorial') || text.includes('guide')) return 'tutorial';
        if (text.includes('component') || text.includes('library')) return 'library';
        if (text.includes('template') || text.includes('starter')) return 'template';
        if (text.includes('tool') || text.includes('utility')) return 'tool';
        if (text.includes('app') || text.includes('application')) return 'application';
        
        return 'other';
    }

    /**
     * Extracts common patterns from examples
     * @param items Parsed documentation items
     * @returns Array of pattern items
     */
    static async extractPatterns(items: DocItem[]): Promise<DocItem[]> {
        const patterns: DocItem[] = [];
        const examples = items.filter(item => 
            item.category === 'example' || 
            item.category === 'tutorial' ||
            item.tags.includes('example')
        );

        // Group similar examples to identify patterns
        const groupedExamples = this.groupSimilarExamples(examples);
        
        for (const [pattern, items] of Object.entries(groupedExamples)) {
            if (items.length >= 2) { // Only create patterns with multiple examples
                patterns.push({
                    crate: 'leptos',
                    version: 'latest',
                    title: `Common Pattern: ${pattern}`,
                    content: `Common implementation pattern found in multiple examples:\n\n${
                        items.map(item => `- ${item.title}: ${item.content}`).join('\n')
                    }`,
                    category: 'pattern',
                    framework: 'leptos',
                    tags: ['pattern', ...items[0].tags],
                    examples: items.flatMap(item => item.examples),
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }

        return patterns;
    }

    private static groupSimilarExamples(examples: DocItem[]): Record<string, DocItem[]> {
        const groups: Record<string, DocItem[]> = {};

        for (const example of examples) {
            const pattern = this.identifyPattern(example);
            if (pattern) {
                groups[pattern] = groups[pattern] || [];
                groups[pattern].push(example);
            }
        }

        return groups;
    }

    private static identifyPattern(example: DocItem): string | null {
        const text = `${example.title} ${example.content}`.toLowerCase();
        
        if (text.includes('routing') || text.includes('router')) return 'Routing';
        if (text.includes('form') || text.includes('input')) return 'Form Handling';
        if (text.includes('state') || text.includes('signal')) return 'State Management';
        if (text.includes('api') || text.includes('fetch')) return 'API Integration';
        if (text.includes('auth') || text.includes('login')) return 'Authentication';
        if (text.includes('style') || text.includes('css')) return 'Styling';
        if (text.includes('test') || text.includes('spec')) return 'Testing';
        if (text.includes('ssr') || text.includes('server')) return 'Server-Side Rendering';
        
        return null;
    }
}
