/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
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

    subscribe(fn: (snapshot: SessionSnapshot) => void): () => void {
        this.subscribers.push(fn);
        fn(this.snapshot);
        // Unsubscribe — call on component destroy or the subscriber leaks.
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== fn);
        };
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