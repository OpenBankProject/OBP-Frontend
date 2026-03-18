export interface AuthStrategy {
    getHeaders(): Promise<HeadersInit>;
}

export class CookieAuthStrategy implements AuthStrategy {
    async getHeaders(): Promise<HeadersInit> {
        return {} // fetch will automatically include cookies
    }
}