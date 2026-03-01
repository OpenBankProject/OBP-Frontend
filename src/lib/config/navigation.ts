import {
  User,
  ShieldUser,
  KeyRound,
  IdCardLanyard,
  CreditCard,
  Server,
  Database,
  GitBranch,
  Route,
  BarChart3,
  Shield,
  Users,
  FileCheck,
  Plus,
  Building2,
  Eye,
  Landmark,
  Box,
  Settings,
  FileText,
  Lock,
  HardDrive,
  Waves,
  FolderOpen,
  Star,
  Plug,
  Package,
  CircleHelp,
  Rocket,
  Banknote,
  Hash,
  Map,
  Radio,
} from "@lucide/svelte";
import { env } from "$env/dynamic/public";

export interface NavigationItem {
  href: string;
  label: string;
  iconComponent: any;
  external?: boolean;
}

export interface NavigationSection {
  id: string;
  label: string;
  iconComponent: any;
  items: NavigationItem[];
  basePaths: string[];
}

// Build navigation items dynamically based on environment variables
function buildMyAccountItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/user", label: "Profile", iconComponent: User },
    { href: "/user/consents", label: "Consents", iconComponent: ShieldUser },
    {
      href: "/user/entitlements",
      label: "My Entitlements",
      iconComponent: IdCardLanyard,
    },
    {
      href: "/account-access/accounts",
      label: "My Accounts",
      iconComponent: Landmark,
    },
    {
      href: "/api-collections",
      label: "My Collections",
      iconComponent: FolderOpen,
    },
    { href: "/user/site-map", label: "Site Map", iconComponent: Map },
  ];

  // Only add Subscriptions link if PUBLIC_SUBSCRIPTIONS_URL is set
  if (env.PUBLIC_SUBSCRIPTIONS_URL) {
    items.push({
      href: env.PUBLIC_SUBSCRIPTIONS_URL,
      label: "Subscriptions",
      iconComponent: CreditCard,
      external: true,
    });
  }

  return items;
}

export const myAccountItems = buildMyAccountItems();

export function getActiveMenuItem(pathname: string) {
  const found = myAccountItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    if (item.href === "/user" && pathname === "/user") {
      return true;
    }
    return pathname.startsWith(item.href) && item.href !== "/user";
  });

  return found || myAccountItems[0]; // fallback to first item
}

// System navigation items
function buildSystemItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/system/cache", label: "Cache", iconComponent: HardDrive },
    {
      href: "/system/config-props",
      label: "Config Props",
      iconComponent: FileText,
    },
    {
      href: "/system/database-pool",
      label: "Database Pool",
      iconComponent: Waves,
    },
    {
      href: "/system/featured-collections",
      label: "Featured Collections",
      iconComponent: Star,
    },
    { href: "/system/log-cache", label: "LogCache", iconComponent: Database },
    {
      href: "/system/migrations",
      label: "Migrations",
      iconComponent: GitBranch,
    },
    {
      href: "/system/webui-props",
      label: "WebUI Props",
      iconComponent: Settings,
    },
  ];

  return items;
}

export const systemItems = buildSystemItems();

// Signals navigation items
function buildSignalsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/system/signal-publish",
      label: "Publish",
      iconComponent: Plus,
    },
    {
      href: "/system/signal-channels",
      label: "Signal Channels",
      iconComponent: Radio,
    },
    {
      href: "/system/signal-channels-stats",
      label: "Signal Stats",
      iconComponent: BarChart3,
    },
  ];

  return items;
}

export const signalsItems = buildSignalsItems();

export function getActiveSignalsMenuItem(pathname: string) {
  const found = signalsItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || signalsItems[0];
}

export function getActiveSystemMenuItem(pathname: string) {
  const found = systemItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || systemItems[0]; // fallback to first item
}

// Integration navigation items
function buildIntegrationItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/integration/method-routings",
      label: "Method Routings",
      iconComponent: Route,
    },
  ];

  return items;
}

export const integrationItems = buildIntegrationItems();

export function getActiveIntegrationMenuItem(pathname: string) {
  const found = integrationItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || integrationItems[0]; // fallback to first item
}

// Metrics navigation items
function buildMetricsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/metrics", label: "API Metrics", iconComponent: BarChart3 },
    {
      href: "/aggregate-metrics",
      label: "Aggregate Metrics",
      iconComponent: BarChart3,
    },
    {
      href: "/connector-metrics",
      label: "Connector Metrics",
      iconComponent: Plug,
    },
    {
      href: "/connector-traces",
      label: "Connector Traces",
      iconComponent: Plug,
    },
    {
      href: "/connector-counts",
      label: "Connector Counts",
      iconComponent: Hash,
    },
  ];

  return items;
}

export const metricsItems = buildMetricsItems();

export function getActiveMetricsMenuItem(pathname: string) {
  const found = metricsItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || metricsItems[0]; // fallback to first item
}

// RBAC navigation items
function buildRbacItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/rbac/roles", label: "Roles", iconComponent: Shield },
    {
      href: "/rbac/entitlements",
      label: "Entitlements",
      iconComponent: KeyRound,
    },
    {
      href: "/rbac/entitlements/create",
      label: "Create Entitlement",
      iconComponent: Plus,
    },
    {
      href: "/rbac/groups",
      label: "Groups",
      iconComponent: Users,
    },
    {
      href: "/rbac/groups/create",
      label: "Create Group",
      iconComponent: Plus,
    },
    {
      href: "/rbac/memberships",
      label: "Memberships",
      iconComponent: Users,
    },
    {
      href: "/rbac/memberships/create",
      label: "Create Membership",
      iconComponent: Plus,
    },
    {
      href: "/rbac/entitlement-requests",
      label: "Entitlement Requests",
      iconComponent: FileCheck,
    },
    {
      href: "/rbac/banks",
      label: "Banks",
      iconComponent: Building2,
    },
  ];

  return items;
}

export const rbacItems = buildRbacItems();

export function getActiveRbacMenuItem(pathname: string) {
  const found = rbacItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || rbacItems[0]; // fallback to first item
}

// Account Access navigation items
function buildAccountAccessItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/account-access/system-views",
      label: "System Views",
      iconComponent: Eye,
    },
    {
      href: "/account-access/custom-views",
      label: "Custom Views",
      iconComponent: Eye,
    },
    {
      href: "/account-access/account-directory",
      label: "Account Directory",
      iconComponent: FolderOpen,
    },
  ];

  return items;
}

export const accountAccessItems = buildAccountAccessItems();

export function getActiveAccountAccessMenuItem(pathname: string) {
  const found = accountAccessItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || accountAccessItems[0]; // fallback to first item
}

// Banks navigation items
function buildBanksItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/banks", label: "Banks", iconComponent: Building2 },
    { href: "/banks/create", label: "Create Bank", iconComponent: Plus },
  ];

  return items;
}

export const banksItems = buildBanksItems();

export function getActiveBanksMenuItem(pathname: string) {
  const found = banksItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || banksItems[0];
}

// Dynamic Entities navigation items
function buildDynamicEntitiesItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/dynamic-entities/system?level=system",
      label: "System",
      iconComponent: Settings,
    },
    {
      href: "/dynamic-entities/system?level=bank",
      label: "Bank",
      iconComponent: Building2,
    },
    {
      href: "/dynamic-entities/system?level=both",
      label: "System + Bank",
      iconComponent: Box,
    },
    {
      href: "/dynamic-entities/personal",
      label: "Personal",
      iconComponent: User,
    },
    {
      href: "/dynamic-entities/diagnostics",
      label: "Diagnostics",
      iconComponent: FileCheck,
    },
  ];

  return items;
}

export const dynamicEntitiesItems = buildDynamicEntitiesItems();

export function getActiveDynamicEntitiesMenuItem(pathname: string) {
  const found = dynamicEntitiesItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || dynamicEntitiesItems[0]; // fallback to first item
}

// Dynamic Endpoints navigation items
function buildDynamicEndpointsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/dynamic-endpoints/system",
      label: "System",
      iconComponent: Plug,
    },
    {
      href: "/dynamic-endpoints/bank",
      label: "Bank",
      iconComponent: Building2,
    },
  ];

  return items;
}

export const dynamicEndpointsItems = buildDynamicEndpointsItems();

export function getActiveDynamicEndpointsMenuItem(pathname: string) {
  const found = dynamicEndpointsItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || dynamicEndpointsItems[0]; // fallback to first item
}

// Products navigation items
function buildProductsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/products", label: "API Products", iconComponent: Package },
    { href: "/products/bootstrap", label: "Bootstrap", iconComponent: Rocket },
    { href: "/products/help", label: "Help", iconComponent: CircleHelp },
  ];

  return items;
}

// Financial Products navigation items
function buildFinancialProductsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/products/financial",
      label: "Financial Products",
      iconComponent: Banknote,
    },
    {
      href: "/products/collections",
      label: "Product Collections",
      iconComponent: FolderOpen,
    },
  ];

  return items;
}

export const financialProductsItems = buildFinancialProductsItems();

export const productsItems = buildProductsItems();

export function getActiveProductsMenuItem(pathname: string) {
  const found = productsItems.find((item) => {
    if (item.external) {
      return false;
    }
    if (item.href === "/products" && pathname === "/products") {
      return true;
    }
    return pathname.startsWith(item.href) && item.href !== "/products";
  });

  return found || productsItems[0];
}

// ABAC navigation items
function buildAbacItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/abac/rules",
      label: "Rules",
      iconComponent: Lock,
    },
    {
      href: "/users?role_name=CanExecuteAbacRule",
      label: "ABAC Users",
      iconComponent: Users,
    },
  ];

  return items;
}

export const abacItems = buildAbacItems();

export function getActiveAbacMenuItem(pathname: string) {
  const found = abacItems.find((item) => {
    // Skip external links for active menu detection
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || abacItems[0]; // fallback to first item
}

export const navSections: NavigationSection[] = [
  { id: "my-account", label: "My Profile", iconComponent: User, items: myAccountItems, basePaths: ["/user", "/account-access/accounts"] },
  { id: "system", label: "System", iconComponent: Server, items: systemItems, basePaths: ["/system"] },
  { id: "signals", label: "Signals", iconComponent: Radio, items: signalsItems, basePaths: ["/system/signal-publish", "/system/signal-channels", "/system/signal-channels-stats"] },
  { id: "integration", label: "Integration", iconComponent: Plug, items: integrationItems, basePaths: ["/integration"] },
  { id: "metrics", label: "Metrics", iconComponent: BarChart3, items: metricsItems, basePaths: ["/metrics", "/aggregate-metrics", "/connector-metrics", "/connector-traces", "/connector-counts"] },
  { id: "abac", label: "ABAC", iconComponent: Lock, items: abacItems, basePaths: ["/abac"] },
  { id: "products", label: "API Products", iconComponent: Package, items: productsItems, basePaths: ["/products"] },
  { id: "financial-products", label: "Financial Products", iconComponent: Banknote, items: financialProductsItems, basePaths: ["/products/financial", "/products/collections"] },
  { id: "rbac", label: "RBAC", iconComponent: Shield, items: rbacItems, basePaths: ["/rbac"] },
  { id: "banks", label: "Banks", iconComponent: Building2, items: banksItems, basePaths: ["/banks"] },
  { id: "account-access", label: "Account Access", iconComponent: Landmark, items: accountAccessItems, basePaths: ["/account-access"] },
  { id: "dynamic-entities", label: "Dynamic Entities", iconComponent: Box, items: dynamicEntitiesItems, basePaths: ["/dynamic-entities"] },
  { id: "dynamic-endpoints", label: "Dynamic Endpoints", iconComponent: Plug, items: dynamicEndpointsItems, basePaths: ["/dynamic-endpoints"] },
];
