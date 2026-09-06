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
import { createLogger } from "$shared/utils/logger";
import { HealthCheckService, type HealthCheckOptions } from "./services/HealthCheckService";
import type { HealthCheckSnapshot } from "./state/HealthCheckState";
import { writable, type Writable } from "svelte/store";

const logger = createLogger('HealthCheckRegistry');

export class HealthCheckRegistry {
    private services: Map<string, HealthCheckService> = new Map();
    public store: Writable<Record<string, HealthCheckSnapshot>> = writable({});


    /**
     * Register a new health check service
     * @param optionsOrService HealthCheckOptions or an existing HealthCheckService instance
     * @returns The registered HealthCheckService instance
     */
    register(optionsOrService: HealthCheckOptions | HealthCheckService): HealthCheckService {
        // Check if service with same name exists
        if (optionsOrService instanceof HealthCheckService) {
            return this.registerService(optionsOrService);
        }

        const options = optionsOrService as HealthCheckOptions;
        const existingService = this.services.get(options.serviceName);
        // Stop the service and replace it with the new one
        if (existingService) {
            logger.info(`HealthCheckService for ${options.serviceName} already exists. Replacing with new configuration.`);
            existingService.stop();
            this.services.delete(options.serviceName);
        }

        const service = new HealthCheckService(options);
        this.services.set(options.serviceName, service);

        service.subscribe((snapshot) => {
            this.store.update(state => ({
                ...state,
                [options.serviceName]: snapshot
            }));
        });

        logger.info(`Registered HealthCheckService for ${options.serviceName}`);
        return service;
    }

    /**
     * Register an existing HealthCheckService instance
     */
    registerService(service: HealthCheckService): HealthCheckService {
        const serviceName = service.getName();
        
        // Check if service with same name exists
        const existingService = this.services.get(serviceName);
        if (existingService && existingService !== service) {
            logger.info(`HealthCheckService for ${serviceName} already exists. Replacing with new service.`);
            existingService.stop();
        }

        this.services.set(serviceName, service);
        
        // Subscribe to the service's state changes
        service.subscribe((snapshot) => {
            this.store.update(state => ({
                ...state,
                [serviceName]: snapshot
            }));
        });

        logger.info(`Registered HealthCheckService for ${serviceName}`);
        return service;
    }

    /**
     * Get a registered health check service by name
     */
    get(serviceName: string): HealthCheckService | undefined {
        return this.services.get(serviceName);
    }

    /**
     * Get the store with health check snapshots
     */
    getStore(): Writable<Record<string, HealthCheckSnapshot>> {
        return this.store;
    }

    /**
     * Start all registered health check services
     */
    startAll(): void {
        logger.info(`Starting all ${this.services.size} registered HealthCheckServices`);
        this.services.forEach(service => service.start());
    }

    /**
     * Stop all registered health check services
     */
    stopAll(): void {
        logger.info(`Stopping all ${this.services.size} registered HealthCheckServices`);
        this.services.forEach(service => service.stop());
    }

    /**
     * Get Overall health status of all API services
     */
    getOverallStatus(): 'healthy' | 'unhealthy' | 'degraded' | 'unknown' {
        const snapshots = Object.values(this.getSnapshots());
        if (snapshots.length === 0) {
            return 'unknown';
        }

        const unhealthyCount = snapshots.filter(s => s.status === 'unhealthy').length;
        const unknownCount = snapshots.filter(s => s.status === 'unknown').length;

        if (unhealthyCount === snapshots.length) {
            return 'unhealthy';
        } else if (unhealthyCount > 0) {
            return 'degraded';
        } else if (unknownCount === snapshots.length) {
            return 'unknown';
        } else if (unknownCount > 0) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }


    getSnapshot(serviceName: string): HealthCheckSnapshot | undefined {
        const service = this.services.get(serviceName);
        return service?.getSnapshot();
    }
    /**
     * get all health check snapshots
     */
    getSnapshots(): Record<string, HealthCheckSnapshot> {
        const result: Record<string, HealthCheckSnapshot> = {};
        this.services.forEach((service, name) => {
            result[name] = service.getSnapshot();
        })
        return result;
    }
}

export const healthCheckRegistry = new HealthCheckRegistry();