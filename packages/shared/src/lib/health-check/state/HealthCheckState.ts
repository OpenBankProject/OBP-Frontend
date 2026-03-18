export interface HealthCheckSnapshot {
    service: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    responseTimeMs?: number;
    error?: string;
    lastChecked: string; // ISO timestamp
    conecutiveFailures: number;
}

export class HealthCheckState {
    private snapshot: HealthCheckSnapshot = {
        service: 'unknown',
        status: 'unknown',
        lastChecked: new Date(0).toISOString(),
        conecutiveFailures: 0,
    }

    private subscribers: Array<(snapshot: HealthCheckSnapshot) => void> = [];
    
    subscribe(fn: (snapshot: HealthCheckSnapshot) => void): void {
        this.subscribers.push(fn);
        fn(this.snapshot);
    }

    setSnapshot(snapshot: Partial<HealthCheckSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...snapshot, lastChecked: new Date().toISOString() };
        if (snapshot.status === 'unhealthy') {
            this.snapshot.conecutiveFailures += 1;
        } else if (snapshot.status === 'healthy') {
            this.snapshot.conecutiveFailures = 0;
            // Clear error when service becomes healthy
            delete this.snapshot.error;
        }
        this.emit();
    }

    private emit(): void {
        this.subscribers.forEach(fn => fn(this.snapshot));
    }

}