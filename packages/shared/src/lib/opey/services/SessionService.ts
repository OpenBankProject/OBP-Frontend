export interface SessionService {
	createSession(): Promise<{ authenticated: boolean }>;
	deleteSession(): Promise<void>;
	getStatus(): Promise<{ status: string }>;
}
