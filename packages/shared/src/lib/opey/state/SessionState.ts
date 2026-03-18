export interface SessionSnapshot {
    isAuthenticated: boolean;
    status: 'ready' | 'loading' | 'error';
    error?: string;
}


/** Create an observer pattern for the chatbot session state
* This will allow components to subscribe to changes in the session state
* and update their UI accordingly.
* Note that this is the Opey Session state, not the Portal Session state
*/
export class SessionState {
    private snapshot: SessionSnapshot = {
        isAuthenticated: false,
        status: 'loading',
    }
    private subscribers: Array<(snapshot: SessionSnapshot) => void> = [];

    subscribe(fn: (snapshot: SessionSnapshot) => void): void {
        this.subscribers.push(fn);
        fn(this.snapshot);
    }

    setAuth(isAuthenticated: boolean): void {
        this.snapshot = {...this.snapshot, isAuthenticated}
        this.emit();
    }

    setStatus(status: SessionSnapshot['status'], error?: string) {
        this.snapshot = { ...this.snapshot, status, error}
        this.emit();
    }

    private emit(): void {
        this.subscribers.forEach(fn => fn(this.snapshot));
    }
}