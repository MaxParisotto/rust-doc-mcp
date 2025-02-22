import { JSDOM } from 'jsdom';
import { DocItem } from '../db.js';

export interface ParsedDoc {
    title: string;
    content: string;
    examples: string[];
    category: string;
    tags: string[];
}

export class DocsRsParser {
    /**
     * Parses documentation from docs.rs HTML content
     * @param html The HTML content from docs.rs
     * @param crate The crate name
     * @param version The crate version
     * @returns Array of parsed documentation items
     */
    static async parse(html: string, crate: string, version: string): Promise<DocItem[]> {
        console.log('Parsing docs.rs content for:', crate, version);
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const items: DocItem[] = [];

        // Log the available classes for debugging
        const allElements = document.querySelectorAll('*');
        const classes = new Set<string>();
        allElements.forEach(el => el.classList.forEach(cls => classes.add(cls)));
        console.log('Available classes:', Array.from(classes));

        // Parse module-level documentation
        const moduleDoc = document.querySelector('#main-content') || document.querySelector('.main-content');
        console.log('Found main content:', moduleDoc ? 'yes' : 'no');
        if (moduleDoc) {
            items.push({
                crate,
                version,
                title: `${crate} - Module Documentation`,
                content: this.cleanContent(moduleDoc.textContent || ''),
                category: 'module',
                framework: crate,
                tags: ['module', 'overview'],
                examples: this.extractExamples(moduleDoc),
                created_at: new Date(),
                updated_at: new Date()
            });
        }

        // Parse items (structs, traits, functions, etc.)
        const itemBlocks = document.querySelectorAll('.item-decl, .item, .module-item');
        console.log('Found item blocks:', itemBlocks.length);
        
        for (const block of itemBlocks) {
            console.log('Processing item:', block.textContent?.slice(0, 100));
            const title = block.querySelector('.item-name')?.textContent || '';
            const docBlock = block.nextElementSibling?.classList.contains('docblock') 
                ? block.nextElementSibling 
                : null;

            if (title && docBlock) {
                items.push({
                    crate,
                    version,
                    title,
                    content: this.cleanContent(docBlock.textContent || ''),
                    category: this.determineCategory(block),
                    framework: crate,
                    tags: this.extractTags(block, docBlock),
                    examples: this.extractExamples(docBlock),
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }

        // Parse trait implementations
        const implBlocks = document.querySelectorAll('.impl-items');
        console.log('Found impl blocks:', implBlocks.length);
        
        for (const block of implBlocks) {
            console.log('Processing impl:', block.textContent?.slice(0, 100));
            const title = block.previousElementSibling?.querySelector('.impl')?.textContent || '';
            if (title) {
                items.push({
                    crate,
                    version,
                    title: `Implementation ${title}`,
                    content: this.cleanContent(block.textContent || ''),
                    category: 'implementation',
                    framework: crate,
                    tags: ['impl', ...this.extractTags(block, block)],
                    examples: this.extractExamples(block),
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }

        return items;
    }

    private static cleanContent(content: string): string {
        return content
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static determineCategory(block: Element): string {
        const text = block.textContent || '';
        if (text.includes('struct ')) return 'struct';
        if (text.includes('enum ')) return 'enum';
        if (text.includes('trait ')) return 'trait';
        if (text.includes('fn ')) return 'function';
        if (text.includes('type ')) return 'type';
        if (text.includes('const ')) return 'constant';
        return 'other';
    }

    private static extractTags(block: Element, docBlock: Element): string[] {
        const tags: Set<string> = new Set();
        
        // Add category as tag
        tags.add(this.determineCategory(block));

        // Extract attribute tags
        const attributes = block.querySelectorAll('.attribute');
        for (const attr of attributes) {
            const text = attr.textContent || '';
            if (text.includes('#[derive')) {
                const derives = text.match(/derive\((.*?)\)/)?.[1].split(',') || [];
                derives.forEach(d => tags.add(d.trim()));
            } else if (text.startsWith('#[')) {
                tags.add(text.slice(2, -1).trim());
            }
        }

        // Extract doc comment tags
        const docText = docBlock.textContent || '';
        const docTags = docText.match(/#\s*\[(.*?)\]/g) || [];
        docTags.forEach(tag => tags.add(tag.slice(2, -1).trim()));

        return Array.from(tags);
    }

    private static extractExamples(element: Element): string[] {
        const examples: string[] = [];
        const codeBlocks = element.querySelectorAll('pre');
        
        for (const block of codeBlocks) {
            const code = block.textContent || '';
            if (code.trim()) {
                examples.push(code.trim());
            }
        }

        return examples;
    }
}
