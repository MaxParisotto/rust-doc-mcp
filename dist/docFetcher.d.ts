export declare class DocFetcher {
    private db;
    private octokit;
    constructor();
    fetchLeptosDocs(): Promise<void>;
    fetchTauriDocs(): Promise<void>;
    private fetchErrorPatterns;
    private extractSolutionFromIssue;
    private fetchIntegrationPatterns;
    private extractIntegrationPatterns;
}
