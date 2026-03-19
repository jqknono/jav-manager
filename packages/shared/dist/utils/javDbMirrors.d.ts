export type JavDbDomainApiResponse = {
    success?: boolean;
    domains?: string[];
    error?: string;
    message?: string;
};
export declare function normalizeDomainOrUrlToHttpsUrl(input: string): string | null;
export declare function mergeMirrorUrls(existing: string[], domainsOrUrls: string[]): string[];
export declare function fetchLatestJavDbDomains(telemetryEndpoint: string, fetchImpl?: typeof fetch): Promise<{
    apiUrl: string;
    domains: string[];
}>;
