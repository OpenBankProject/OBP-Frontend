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
import { createToaster } from '@skeletonlabs/skeleton-svelte';

// Create a single toaster instance for the entire application
export const toaster = createToaster({
    max: 5,
    duration: 3000,
});

// Optional: Create helper functions for common toast types
export const toast = {
    info: (title: string, description?: string) => {
        toaster.info({ title, description });
    },
    success: (title: string, description?: string) => {
        toaster.success({ title, description });
    },
    warning: (title: string, description?: string) => {
        toaster.warning({ title, description, duration: 10000 });
    },
    error: (title: string, description?: string) => {
        toaster.error({ title, description, duration: 0 });
    },
    promise: <T>(promise: Promise<T>, options: any) => {
        return toaster.promise(promise, options);
    }
};