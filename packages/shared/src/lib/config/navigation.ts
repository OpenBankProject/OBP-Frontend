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
import { User, ShieldUser, KeyRound, IdCardLanyard, CreditCard, Database, FolderKanban, FileText } from '@lucide/svelte';

export interface NavigationItem {
    href: string;
    label: string;
    iconComponent: any;
    external?: boolean;
    description?: string;
}

export interface NavigationSection {
    id: string;
    label: string;
    iconComponent: any;
    items: NavigationItem[];
    basePaths: string[];
}

export interface NavigationConfig {
    subscriptionsUrl?: string;
}

export function buildMyAccountItems(config: NavigationConfig = {}): NavigationItem[] {
    const items: NavigationItem[] = [
        { href: '/user', label: 'Profile', iconComponent: User },
        { href: '/user/consents', label: 'Consents', iconComponent: ShieldUser },
        { href: '/user/consumers', label: 'Consumers', iconComponent: KeyRound },
        { href: '/user/entitlements', label: 'Entitlements', iconComponent: IdCardLanyard },
        { href: '/user/my-data', label: 'My Data', iconComponent: Database, description: 'View my own data.' },
        { href: '/user/personal-data-fields', label: 'Personal Data Fields', iconComponent: FileText, description: 'Manage your personal attributes.' },
        { href: '/user/api-collections', label: 'My API Collections', iconComponent: FolderKanban, description: 'Manage your API endpoint collections.' }
    ];

    // Only add Subscriptions link if subscriptionsUrl is set
    if (config.subscriptionsUrl) {
        items.push({
            href: config.subscriptionsUrl,
            label: 'Subscriptions',
            iconComponent: CreditCard,
            external: true
        });
    }

    return items;
}

export function getActiveMenuItem(menuItems: NavigationItem[], pathname: string) {
    const found = menuItems.find(item => {
        // Skip external links for active menu detection
        if (item.external) {
            return false;
        }
        if (item.href === '/user' && pathname === '/user') {
            return true;
        }
        return pathname.startsWith(item.href) && item.href !== '/user';
    });

    return found || menuItems[0]; // fallback to first item
}
