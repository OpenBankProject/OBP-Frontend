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
export interface HealthCheckSnapshot {
    service: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    responseTimeMs?: number;
    error?: string;
    lastChecked: string; // ISO timestamp
    conecutiveFailures: number;
    intervalMs?: number; // How often this check runs — lets consumers detect stale results
    details?: Record<string, string | number>;
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