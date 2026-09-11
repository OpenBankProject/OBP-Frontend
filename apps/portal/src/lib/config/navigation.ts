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
import { Activity, User, ShieldUser, KeyRound, IdCardLanyard, CreditCard, Database, FolderKanban, UserPlus, LayoutList, FileText, HandCoins, FileCheck, ArrowRightLeft, ScanEye, Code, Rocket, BookOpen, KeySquare, LogIn, ShieldCheck, Bot, Cpu, Workflow, SendHorizontal, Compass, Telescope, ScrollText, Repeat, Eye, Wallet, AppWindow, Package, UserRound, Landmark, MessageSquare, Library, LifeBuoy, Star, CircleHelp, ShoppingBag, GraduationCap, Server, Info } from '@lucide/svelte';

export interface NavigationItem {
    href: string;
    label: string;
    iconComponent: any;
    external?: boolean;
    description?: string;
    /** Hide this link from signed-out visitors, in an otherwise public section. */
    requiresAuth?: boolean;
}

// Build navigation items dynamically based on environment variables
function buildMyAccountItems(): NavigationItem[] {
    const items: NavigationItem[] = [
        { href: '/user', label: 'Profile', iconComponent: User },
        { href: '/user/accounts', label: 'Accounts', iconComponent: Wallet, description: 'Your bank accounts and recent activity.' },
        { href: '/user/consents', label: 'Consents', iconComponent: ShieldUser },
        { href: '/user/consumers', label: 'Consumers (Applications)', iconComponent: KeyRound },
        { href: '/user/entitlements', label: 'Entitlements', iconComponent: IdCardLanyard },
        { href: '/user/my-data', label: 'My Data', iconComponent: Database, description: 'View my own data.' },
        { href: '/user/personal-data-fields', label: 'Personal Data Fields', iconComponent: FileText, description: 'Manage your personal attributes.' },
        { href: '/user/api-collections', label: 'My API Collections', iconComponent: FolderKanban, description: 'Manage your API endpoint collections.' },
        { href: '/user/my-activity-dashboard', label: 'Activity Dashboard', iconComponent: Activity, description: 'API calls you have made, most recent first.' }
    ];

    // The Portal's own subscriptions page (apply for / cancel API Product Subscriptions).
    // It also links to the external billing service when PUBLIC_SUBSCRIPTIONS_URL is set.
    items.push({
        href: '/subscriptions',
        label: 'Subscriptions',
        iconComponent: CreditCard,
        description: 'Subscribe your applications to API products.'
    });

    return items;
}

export const myAccountItems = buildMyAccountItems();

export const earlyAccessItems: NavigationItem[] = [
    { href: '/add-user-auth-context-update-request', label: 'Onboarding', iconComponent: UserPlus, description: 'User auth context update / onboarding flow.' },
    { href: '/confirm-user-auth-context-update-request', label: 'Confirm Onboarding', iconComponent: FileCheck, description: 'Confirm auth context update with OTP.' },
    { href: '/otp', label: 'OTP Verification', iconComponent: ShieldUser, description: 'One-time password verification.' },
    { href: '/confirm-vrp-consent-request', label: 'VRP Consent Request', iconComponent: HandCoins, description: 'Review and confirm a VRP consent request.' },
    { href: '/confirm-vrp-consent', label: 'VRP Consent OTP', iconComponent: HandCoins, description: 'Finalise VRP consent with OTP.' },
    { href: '/confirm-bg-consent-request', label: 'BG Consent Request', iconComponent: ArrowRightLeft, description: 'Review and confirm a Berlin Group consent.' },
    { href: '/confirm-bg-consent-request-sca', label: 'BG Consent SCA', iconComponent: ArrowRightLeft, description: 'Berlin Group consent strong customer authentication.' },
    { href: '/confirm-bg-consent-request-redirect-uri', label: 'BG Consent Redirect', iconComponent: ArrowRightLeft, description: 'Berlin Group consent redirect after confirmation.' },
    { href: '/consent-screen', label: 'Consent Screen', iconComponent: ScanEye, description: 'OAuth consent screen.' },
];

export const developerItems: NavigationItem[] = [
    { href: '/developers/getting-started', label: 'Getting Started', iconComponent: Rocket, description: 'Get up and running with the OBP API.' },
    { href: '/developers/obp-concepts', label: 'OBP Concepts', iconComponent: BookOpen, description: 'Core concepts behind the Open Bank Project API.' },
    { href: '/developers/consumer-creation', label: 'Consumer Creation', iconComponent: KeySquare, description: 'Register an app and get your API key.' },
    { href: '/developers/direct-login', label: 'Direct Login', iconComponent: LogIn, description: 'Authenticate directly with username and password.' },
    { href: '/developers/oauth2-oidc', label: 'OAuth2 / OIDC', iconComponent: ShieldCheck, description: 'OAuth2 and OpenID Connect authentication flows.' },
    { href: '/developers/application-access', label: 'Application Access', iconComponent: AppWindow, description: 'Client Credentials and Consumer authentication.' },
    { href: '/developers/account-access', label: 'Account Access', iconComponent: Eye, description: 'How account access and Views work in OBP.' },
    { href: '/developers/access-to-accounts', label: 'Access to Accounts', iconComponent: Wallet, description: 'List, view, and work with bank accounts via the API.' },
    { href: '/developers/consents', label: 'Consents', iconComponent: ScrollText, description: 'Account access consents for third-party applications.' },
    { href: '/developers/variable-recurring-payments', label: 'Variable Recurring Payments', iconComponent: Repeat, description: 'VRP consents for recurring payments within agreed limits.' },
    { href: '/developers/transaction-requests', label: 'Transaction Requests', iconComponent: SendHorizontal, description: 'Make payments using Transaction Requests.' },
    { href: '/developers/api-explorer', label: 'About Explorer', iconComponent: Info, description: 'What the API Explorer is and how to use it.' },
    { href: '/developers/opey', label: 'Opey', iconComponent: Bot, description: 'The OBP AI assistant for exploring the API.' },
    { href: '/developers/opey-permissions', label: 'What Opey Can Do', iconComponent: ShieldUser, description: 'Consents, entitlements and the accountable user: what Opey may do for you.' },
    { href: '/developers/agents-and-mcp', label: 'Agents and MCP', iconComponent: Workflow, description: 'Use AI agents and the Model Context Protocol with OBP.' },
    { href: '/developers/sdks', label: 'SDKs', iconComponent: Package, description: 'Client SDKs for the OBP API in multiple programming languages.' },
];

export function getActiveDeveloperItem(pathname: string) {
    // Segment-aware: '/developers/opey-permissions' must not light up '/developers/opey'.
    return developerItems.find(item => pathname === item.href || pathname.startsWith(item.href + '/')) || developerItems[0];
}

export function getActiveMenuItem(pathname: string) {
    const found = myAccountItems.find(item => {
        // Skip external links for active menu detection
        if (item.external) {
            return false;
        }
        if (item.href === '/user' && pathname === '/user') {
            return true;
        }
        return (pathname === item.href || pathname.startsWith(item.href + '/')) && item.href !== '/user';
    });
    
    return found || myAccountItems[0]; // fallback to first item
}

// ── Sidebar structure (2026-09-11) ────────────────────────────────────────────
// Domains named for what the visitor is doing, each with headed subsections — the
// same shape as the API Manager's sidebar, with the verbs of this audience: a person
// with accounts, and a developer building on them. Every page lives in exactly one
// domain, so the top bar stays thin and the flat list above the domains is only for
// jumping to the other OBP apps.

export interface NavigationSubsection {
    label: string;
    items: NavigationItem[];
}

export interface NavigationSection {
    id: string;
    label: string;
    iconComponent: any;
    items: NavigationItem[];
    subsections?: NavigationSubsection[];
    /** Hidden from signed-out visitors. The documentation, catalogue and support domains are public. */
    requiresAuth?: boolean;
    /** Start expanded, for a section whose contents are the point rather than a menu to open. */
    defaultExpanded?: boolean;
    basePaths: string[];
}

function domain(
    id: string,
    label: string,
    iconComponent: any,
    basePaths: string[],
    subsections: NavigationSubsection[],
    requiresAuth = false,
    defaultExpanded = false
): NavigationSection {
    return { id, label, iconComponent, basePaths, subsections, requiresAuth, defaultExpanded, items: subsections.flatMap((g) => g.items) };
}

// Everything about the person using the Portal: who they are, what they have registered,
// what they have granted, and what they have made. Its own /user route tree, plus the two
// pages that sit outside it for historical reasons (/subscriptions, /consumers/register is
// in Develop because it is public).
const meSection = domain('me', 'My', UserRound,
    ['/user', '/subscriptions'],
    [
        { label: 'Identity', items: [
            { href: '/user', label: 'Profile', iconComponent: User },
            { href: '/user/personal-data-fields', label: 'Personal Data Fields', iconComponent: FileText, description: 'Manage your personal attributes.' }
        ] },
        { label: 'Applications', items: [
            { href: '/user/consumers', label: 'Applications (Consumers)', iconComponent: KeyRound },
            { href: '/subscriptions', label: 'Subscriptions', iconComponent: CreditCard, description: 'Subscribe your applications to API products.' }
        ] },
        { label: 'Permissions', items: [
            { href: '/user/consents', label: 'Consents', iconComponent: ShieldUser },
            { href: '/user/entitlements', label: 'Entitlements', iconComponent: IdCardLanyard }
        ] },
        { label: 'Data', items: [
            { href: '/user/my-data', label: 'My Data', iconComponent: Database, description: 'View my own data.' },
            { href: '/user/my-activity-dashboard', label: 'Activity Dashboard', iconComponent: Activity, description: 'API calls you have made, most recent first.' },
            { href: '/user/api-collections', label: 'My API Collections', iconComponent: FolderKanban, description: 'Manage your API endpoint collections.' }
        ] },
        { label: 'Bank', items: [
            { href: '/user/accounts', label: 'Accounts', iconComponent: Wallet, description: 'Your bank accounts and recent activity.' }
        ] }
    ], true);

// Its own domain rather than a corner of My: a conversation is not an account or a credential,
// and the API Manager names this domain the same way, so the two apps read alike.
const messagingSection = domain('messaging', 'Messaging', MessageSquare,
    ['/user/chat'],
    [
        { label: '', items: [
            { href: '/user/chat', label: 'Chat', iconComponent: MessageSquare, description: 'Your chat rooms.' }
        ] }
    ], true);

const developSection = domain('develop', 'Developing', Code,
    ['/developers', '/training', '/consumers/register', '/api-explorer', '/add-user-auth-context-update-request', '/confirm-user-auth-context-update-request', '/otp', '/confirm-vrp-consent-request', '/confirm-vrp-consent', '/confirm-bg-consent-request', '/confirm-bg-consent-request-sca', '/confirm-bg-consent-request-redirect-uri', '/consent-screen'],
    [
        { label: 'Start', items: [
            { href: '/developers/getting-started', label: 'Getting Started', iconComponent: Rocket, description: 'Get up and running with the OBP API.' },
            { href: '/developers/obp-concepts', label: 'OBP Concepts', iconComponent: BookOpen, description: 'Core concepts behind the Open Bank Project API.' },
            { href: '/developers/sdks', label: 'SDKs', iconComponent: Package, description: 'Client SDKs for the OBP API in multiple programming languages.' },
            { href: '/training', label: 'Training', iconComponent: GraduationCap, description: 'Guided material for learning the platform.' },
            { href: '/consumers/register', label: 'Get API Key', iconComponent: KeySquare, description: 'Register an application and get its key.' }
        ] },
        { label: 'Authenticate', items: [
            { href: '/developers/consumer-creation', label: 'Consumer Creation', iconComponent: KeySquare, description: 'Register an app and get your API key.' },
            { href: '/developers/direct-login', label: 'Direct Login', iconComponent: LogIn, description: 'Authenticate directly with username and password.' },
            { href: '/developers/oauth2-oidc', label: 'OAuth2 / OIDC', iconComponent: ShieldCheck, description: 'OAuth2 and OpenID Connect authentication flows.' },
            { href: '/developers/application-access', label: 'Application Access', iconComponent: AppWindow, description: 'Client Credentials and Consumer authentication.' }
        ] },
        { label: 'Accounts', items: [
            { href: '/developers/account-access', label: 'Account Access', iconComponent: Eye, description: 'How account access and Views work in OBP.' },
            { href: '/developers/access-to-accounts', label: 'Access to Accounts', iconComponent: Wallet, description: 'List, view, and work with bank accounts via the API.' },
            { href: '/developers/consents', label: 'Consents', iconComponent: ScrollText, description: 'Account access consents for third-party applications.' },
            { href: '/developers/variable-recurring-payments', label: 'Variable Recurring Payments', iconComponent: Repeat, description: 'VRP consents for recurring payments within agreed limits.' }
        ] },
        { label: 'Pay', items: [
            { href: '/developers/transaction-requests', label: 'Transaction Requests', iconComponent: SendHorizontal, description: 'Make payments using Transaction Requests.' }
        ] },
        { label: 'AI', items: [
            { href: '/developers/opey', label: 'Opey', iconComponent: Bot, description: 'The OBP AI assistant for exploring the API.' },
            { href: '/developers/opey-permissions', label: 'What Opey Can Do', iconComponent: ShieldUser, description: 'Consents, entitlements and the accountable user: what Opey may do for you.' },
            { href: '/developers/agents-and-mcp', label: 'Agents and MCP', iconComponent: Workflow, description: 'Use AI agents and the Model Context Protocol with OBP.' }
        ] },
        { label: 'Explore', items: [
            { href: '/developers/api-explorer', label: 'About Explorer', iconComponent: Info, description: 'What the API Explorer is and how to use it.' },
            { href: '/api-explorer', label: 'API Explorer III', iconComponent: Telescope, description: 'The third-generation Explorer, running inside the Portal.' }
        ] },
        { label: 'Onboarding Flows', items: [
            { href: '/add-user-auth-context-update-request', label: 'Onboarding', iconComponent: UserPlus, description: 'User auth context update / onboarding flow.', requiresAuth: true },
            { href: '/confirm-user-auth-context-update-request', label: 'Confirm Onboarding', iconComponent: FileCheck, description: 'Confirm auth context update with OTP.', requiresAuth: true },
            { href: '/otp', label: 'OTP Verification', iconComponent: ShieldUser, description: 'One-time password verification.', requiresAuth: true }
        ] },
        { label: 'Consent Flows', items: [
            { href: '/confirm-vrp-consent-request', label: 'VRP Consent Request', iconComponent: HandCoins, description: 'Review and confirm a VRP consent request.', requiresAuth: true },
            { href: '/confirm-vrp-consent', label: 'VRP Consent OTP', iconComponent: HandCoins, description: 'Finalise VRP consent with OTP.', requiresAuth: true },
            { href: '/confirm-bg-consent-request', label: 'BG Consent Request', iconComponent: ArrowRightLeft, description: 'Review and confirm a Berlin Group consent.', requiresAuth: true },
            { href: '/confirm-bg-consent-request-sca', label: 'BG Consent SCA', iconComponent: ArrowRightLeft, description: 'Berlin Group consent strong customer authentication.', requiresAuth: true },
            { href: '/confirm-bg-consent-request-redirect-uri', label: 'BG Consent Redirect', iconComponent: ArrowRightLeft, description: 'Berlin Group consent redirect after confirmation.', requiresAuth: true },
            { href: '/consent-screen', label: 'Consent Screen', iconComponent: ScanEye, description: 'OAuth consent screen.', requiresAuth: true }
        ] }
    ]);

// The shop window. Everything else in the sidebar is somewhere you go on purpose; this is what
// a visitor should see without opening anything, so it leads the list and starts expanded.
const catalogueSection = domain('catalogue', 'Catalogue', Library,
    ['/products', '/financial-products', '/featured', '/faq', '/pages'],
    [
        { label: 'Products', items: [
            { href: '/products', label: 'API Products', iconComponent: ShoppingBag },
            { href: '/financial-products', label: 'Financial Products', iconComponent: Landmark }
        ] },
        { label: 'Reading', items: [
            { href: '/featured', label: 'Featured', iconComponent: Star },
            { href: '/pages', label: 'Pages', iconComponent: FileText },
            { href: '/faq', label: 'FAQ', iconComponent: CircleHelp }
        ] }
    ], false, true);

const supportSection = domain('support', 'Support', LifeBuoy,
    ['/support', '/status', '/about'],
    [
        { label: '', items: [
            { href: '/support', label: 'Support', iconComponent: LifeBuoy },
            { href: '/status', label: 'Status', iconComponent: Server },
            { href: '/about', label: 'About', iconComponent: Info }
        ] }
    ]);

/** The sidebar's domains, in order. */
export const navigationSections: NavigationSection[] = [
    catalogueSection,
    meSection,
    messagingSection,
    developSection,
    supportSection
];

/** The domain a path belongs to, for expanding the right one on navigation. */
export function getActiveSection(pathname: string): NavigationSection | undefined {
    return navigationSections.find((section) =>
        section.basePaths.some((bp) => pathname === bp || pathname.startsWith(bp + '/'))
    );
}
