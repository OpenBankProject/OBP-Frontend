import { User, ShieldUser, KeyRound, IdCardLanyard, CreditCard, Database, FolderKanban, UserPlus, LayoutList, FileText, HandCoins, FileCheck, ArrowRightLeft, ScanEye } from '@lucide/svelte';
import { env } from '$env/dynamic/public';

export interface NavigationItem {
    href: string;
    label: string;
    iconComponent: any;
    external?: boolean;
    description?: string;
}

// Build navigation items dynamically based on environment variables
function buildMyAccountItems(): NavigationItem[] {
    const items: NavigationItem[] = [
        { href: '/user', label: 'Profile', iconComponent: User },
        { href: '/user/consents', label: 'Consents', iconComponent: ShieldUser },
        { href: '/user/consumers', label: 'Consumers', iconComponent: KeyRound },
        { href: '/user/entitlements', label: 'Entitlements', iconComponent: IdCardLanyard },
        { href: '/user/my-data', label: 'My Data', iconComponent: Database, description: 'View my own data.' },
        { href: '/user/personal-data-fields', label: 'Personal Data Fields', iconComponent: FileText, description: 'Manage your personal attributes.' },
        { href: '/user/api-collections', label: 'My API Collections', iconComponent: FolderKanban, description: 'Manage your API endpoint collections.' }
    ];

    // Only add Subscriptions link if PUBLIC_SUBSCRIPTIONS_URL is set
    if (env.PUBLIC_SUBSCRIPTIONS_URL) {
        items.push({
            href: env.PUBLIC_SUBSCRIPTIONS_URL,
            label: 'Subscriptions',
            iconComponent: CreditCard,
            external: true
        });
    }

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

export function getActiveMenuItem(pathname: string) {
    const found = myAccountItems.find(item => {
        // Skip external links for active menu detection
        if (item.external) {
            return false;
        }
        if (item.href === '/user' && pathname === '/user') {
            return true;
        }
        return pathname.startsWith(item.href) && item.href !== '/user';
    });
    
    return found || myAccountItems[0]; // fallback to first item
}
