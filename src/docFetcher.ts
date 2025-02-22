import axios from 'axios';
import { JSDOM } from 'jsdom';
import { DocumentationDB, DocItem } from './db.js';
import { Octokit } from '@octokit/rest';

export class DocFetcher {
    private db: DocumentationDB;
    private octokit: Octokit;
    
    constructor() {
        this.db = DocumentationDB.getInstance();
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
    }

    async fetchLeptosDocs(): Promise<void> {
        try {
            // Fetch official docs
            const officialDocs = await axios.get('https://docs.rs/leptos/latest/leptos/');
            const dom = new JSDOM(officialDocs.data);
            const document = dom.window.document;

            // Process and store official documentation
            const modules = document.querySelectorAll('.module-item');
            for (const module of modules) {
                const title = module.querySelector('.module-item-title')?.textContent || '';
                const content = module.querySelector('.docblock')?.textContent || '';
                
                await this.db.addDocument({
                    crate: 'leptos',
                    version: 'latest',
                    title,
                    content,
                    category: 'api',
                    framework: 'leptos',
                    tags: ['official', 'api'],
                    examples: [],
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }

            // Fetch awesome-leptos examples
            const { data: awesomeLeptos } = await this.octokit.repos.getContent({
                owner: 'leptos-rs',
                repo: 'awesome-leptos',
                path: 'README.md'
            });

            if ('content' in awesomeLeptos) {
                const content = Buffer.from(awesomeLeptos.content, 'base64').toString();
                const sections = content.split('\n## ');

                for (const section of sections) {
                    const [title, ...items] = section.split('\n');
                    const examples = items
                        .filter(item => item.startsWith('- ['))
                        .map(item => {
                            const matches = item.match(/\[(.*?)\]\((.*?)\)/);
                            return matches ? { title: matches[1], url: matches[2] } : null;
                        })
                        .filter(item => item !== null);

                    if (examples.length > 0) {
                        await this.db.addDocument({
                            crate: 'leptos',
                            version: 'latest',
                            title: title.trim(),
                            content: examples.map(e => `${e!.title}: ${e!.url}`).join('\n'),
                            category: 'examples',
                            framework: 'leptos',
                            tags: ['community', 'examples'],
                            examples: examples.map(e => e!.url),
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }
                }
            }

            // Fetch common patterns and store them
            await this.storeCommonPatterns();

        } catch (error) {
            console.error('Error fetching Leptos docs:', error);
            throw error;
        }
    }

    async fetchTauriDocs(): Promise<void> {
        try {
            // Fetch official Tauri docs
            const officialDocs = await axios.get('https://tauri.app/v1/api/js');
            const dom = new JSDOM(officialDocs.data);
            const document = dom.window.document;

            // Process API documentation
            const apiSections = document.querySelectorAll('.api-section');
            for (const section of apiSections) {
                const title = section.querySelector('h2')?.textContent || '';
                const content = section.querySelector('.content')?.textContent || '';
                const examples = Array.from(section.querySelectorAll('pre code'))
                    .map(code => code.textContent || '');

                await this.db.addDocument({
                    crate: 'tauri',
                    version: 'v1',
                    title,
                    content,
                    category: 'api',
                    framework: 'tauri',
                    tags: ['official', 'api'],
                    examples,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }

            // Store common error patterns
            await this.storeCommonErrors();

        } catch (error) {
            console.error('Error fetching Tauri docs:', error);
            throw error;
        }
    }

    private async storeCommonPatterns(): Promise<void> {
        const patterns = [
            {
                name: 'Signal Component Pattern',
                description: 'Pattern for creating a component with reactive state using signals',
                code_template: `
#[component]
fn MyComponent() -> impl IntoView {
    let (count, set_count) = create_signal(0);
    
    view! {
        <div>
            <button on:click=move |_| set_count.update(|n| *n + 1)>
                "Count: " {count}
            </button>
        </div>
    }
}`,
                framework: 'leptos',
                category: 'state-management'
            },
            {
                name: 'Resource Loading Pattern',
                description: 'Pattern for loading async data using resources',
                code_template: `
#[component]
fn DataLoader() -> impl IntoView {
    let data = create_resource(
        || (),
        |_| async move { fetch_data().await }
    );

    view! {
        <div>
            <Suspense
                fallback=move || view! { <div>"Loading..."</div> }
            >
                {move || data.get().map(|d| view! { <div>{d}</div> })}
            </Suspense>
        </div>
    }
}`,
                framework: 'leptos',
                category: 'async'
            }
        ];

        for (const pattern of patterns) {
            await this.db.addPattern(pattern);
        }
    }

    private async storeCommonErrors(): Promise<void> {
        const errors = [
            {
                error_pattern: 'cannot find macro `view` in this scope',
                solution: 'Add the "leptos_macro" feature to your dependencies',
                example_fix: `
[dependencies]
leptos = { version = "0.5", features = ["csr", "nightly", "leptos_macro"] }`,
                framework: 'leptos'
            },
            {
                error_pattern: 'failed to resolve: use of undeclared type or module',
                solution: 'Import the necessary types from tauri',
                example_fix: `
use tauri::Manager;
use tauri::api::shell::open;`,
                framework: 'tauri'
            }
        ];

        for (const error of errors) {
            await this.db.addErrorSolution(error);
        }
    }
}
