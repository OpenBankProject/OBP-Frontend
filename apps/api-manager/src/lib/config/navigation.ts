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
import {
  User,
  UserRound,
  ShieldUser,
  KeyRound,
  IdCardLanyard,
  CreditCard,
  Server,
  Database,
  GitBranch,
  Route,
  BarChart3,
  LayoutDashboard,
  Shield,
  Users,
  FileCheck,
  Plus,
  Building,
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
  Smartphone,
  FileSpreadsheet,
  LayoutTemplate,
  Package,
  CircleHelp,
  Braces,
  Rocket,
  Banknote,
  Hash,
  Map,
  Radio,
  FileSignature,
  Search,
  ToggleLeft,
  BookOpen,
  AppWindow,
  Link,
  Zap,
  ShieldOff,
  MessageSquare,
  Mail,
  Stethoscope,
  Play,
  Clock,
  Gauge,
  Hammer,
  Activity,
  Library,
  MessagesSquare,
} from "@lucide/svelte";
import { env } from "$env/dynamic/public";

export interface NavigationItem {
  href: string;
  label: string;
  iconComponent: any;
  external?: boolean;
}

/** A labelled run of items inside a section; the label is a heading, not a link. */
export interface NavigationSubsection {
  label: string;
  items: NavigationItem[];
}

export interface NavigationSection {
  id: string;
  label: string;
  iconComponent: any;
  /** Every link in the section, in order. Derived from `subsections` when those are given. */
  items: NavigationItem[];
  /** Grouped rendering; when absent the sidebar lists `items` flat. */
  subsections?: NavigationSubsection[];
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
    { href: "/site-map", label: "Site Map", iconComponent: Map },
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
      href: "/system/features",
      label: "Features",
      iconComponent: ToggleLeft,
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
      href: "/system/rate-limiting",
      label: "Rate Limiting",
      iconComponent: Gauge,
    },
    {
      href: "/system/scheduler-job-locks",
      label: "Scheduler Job Locks",
      iconComponent: Clock,
    },
    {
      href: "/system/self-test-emails",
      label: "Self Test Email",
      iconComponent: Mail,
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
    {
      href: "/system/signal-publish/help",
      label: "Help",
      iconComponent: CircleHelp,
    },
  ];

  return items;
}

export const signalsItems = buildSignalsItems();

export function getActiveSignalsMenuItem(pathname: string) {
  // Exact match first so /system/signal-publish/help resolves to Help, not Publish.
  const exact = signalsItems.find((item) => !item.external && pathname === item.href);
  const found =
    exact ||
    signalsItems.find((item) => {
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
    {
      href: "/integration/method-routings/create",
      label: "Create Method Routing",
      iconComponent: Route,
    },
  ];

  return items;
}

// JSON Schema Validation navigation items
function buildJsonSchemaValidationItems(): NavigationItem[] {
  return [
    { href: "/json-schema-validations", label: "JSON Schema Validations", iconComponent: Braces },
    { href: "/json-schema-validations/create", label: "Create Validation", iconComponent: Plus },
    { href: "/json-schema-validations/help", label: "Help", iconComponent: CircleHelp },
  ];
}

export const jsonSchemaValidationItems = buildJsonSchemaValidationItems();

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
    {
      href: "/system-activity-dashboard",
      label: "Dashboard",
      iconComponent: LayoutDashboard,
    },
    { href: "/metrics", label: "API Metrics", iconComponent: BarChart3 },
    {
      href: "/aggregate-metrics-live",
      label: "Live Aggregate Metrics",
      iconComponent: BarChart3,
    },
    {
      href: "/aggregate-metrics-trends",
      label: "Aggregate Metrics Over Time",
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
    {
      href: "/metrics-diagnostics",
      label: "Diagnostics",
      iconComponent: Stethoscope,
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
    // Match on path boundaries so e.g. /metrics-diagnostics is not treated as /metrics
    return pathname === item.href || pathname.startsWith(item.href + "/");
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
      href: "/rbac/entitlements/bulk-grant",
      label: "Bulk Grant",
      iconComponent: Zap,
    },
    {
      href: "/rbac/entitlements/bulk-revoke",
      label: "Bulk Revoke",
      iconComponent: ShieldOff,
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
      href: "/account-access/view-permissions",
      label: "View Permissions",
      iconComponent: Shield,
    },
    {
      href: "/account-access/account-directory",
      label: "Account Directory",
      iconComponent: FolderOpen,
    },
    {
      href: "/mandates",
      label: "Mandates",
      iconComponent: FileSignature,
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

// Dynamic Resource Docs navigation items
function buildDynamicResourceDocsItems(): NavigationItem[] {
  return [
    {
      href: "/dynamic-resource-docs/system",
      label: "System",
      iconComponent: Plug,
    },
    {
      href: "/dynamic-resource-docs/help",
      label: "Help",
      iconComponent: CircleHelp,
    },
  ];
}

// App Studio: Opey writes a phone-sized web app that calls OBP from a sandboxed preview
function buildAppStudioItems(): NavigationItem[] {
  return [
    {
      href: "/app-studio",
      label: "App Studio",
      iconComponent: Smartphone,
    },
    {
      href: "/app-studio/blocks",
      label: "Page Blocks",
      iconComponent: LayoutTemplate,
    },
    {
      href: "/app-studio/help",
      label: "Help",
      iconComponent: CircleHelp,
    },
  ];
}

export const dynamicResourceDocsItems = buildDynamicResourceDocsItems();
export const appStudioItems = buildAppStudioItems();

// Reports: Opey-written report definitions that run in the browser against OBP
export const reportsItems: NavigationItem[] = [
  { href: "/reports", label: "Reports", iconComponent: FileSpreadsheet },
  { href: "/reports/new", label: "New Report", iconComponent: FileSpreadsheet },
];

export function getActiveDynamicResourceDocsMenuItem(pathname: string) {
  const found = dynamicResourceDocsItems.find((item) => {
    if (item.external) return false;
    return pathname.startsWith(item.href);
  });

  return found || dynamicResourceDocsItems[0];
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
      href: "/products/financial/all-banks",
      label: "Financial Products at All Banks",
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

// Users navigation items
function buildUsersItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    { href: "/users", label: "Search", iconComponent: Search },
  ];

  return items;
}

export const usersItems = buildUsersItems();

export function getActiveUsersMenuItem(pathname: string) {
  const found = usersItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || usersItems[0];
}

// Management Docs navigation items
function buildManagementDocsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/management-docs/consumers",
      label: "Consumers",
      iconComponent: AppWindow,
    },
    {
      href: "/management-docs/users",
      label: "Users",
      iconComponent: Users,
    },
    {
      href: "/management-docs/entitlements",
      label: "Entitlements",
      iconComponent: KeyRound,
    },
    {
      href: "/management-docs/chat-rooms",
      label: "Chat Rooms",
      iconComponent: MessageSquare,
    },
  ];

  return items;
}

export const managementDocsItems = buildManagementDocsItems();

export function getActiveManagementDocsMenuItem(pathname: string) {
  const found = managementDocsItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || managementDocsItems[0];
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

// Customers navigation items
function buildCustomersItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/customers/individual",
      label: "Individual",
      iconComponent: UserRound,
    },
    {
      href: "/customers/corporate",
      label: "Corporate",
      iconComponent: Building,
    },
    {
      href: "/customers/account-links",
      label: "Account Links",
      iconComponent: Link,
    },
    {
      href: "/customers/graph",
      label: "Graph",
      iconComponent: GitBranch,
    },
  ];

  return items;
}

export const customersItems = buildCustomersItems();

export function getActiveCustomersMenuItem(pathname: string) {
  const found = customersItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || customersItems[0];
}

// Chat Rooms navigation items
function buildChatRoomsItems(): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: "/chat-rooms/system",
      label: "System",
      iconComponent: Settings,
    },
    {
      href: "/chat-rooms/bank",
      label: "Bank",
      iconComponent: Building2,
    },
  ];

  return items;
}

export const chatRoomsItems = buildChatRoomsItems();

export function getActiveChatRoomsMenuItem(pathname: string) {
  const found = chatRoomsItems.find((item) => {
    if (item.external) {
      return false;
    }
    return pathname.startsWith(item.href);
  });

  return found || chatRoomsItems[0];
}

// ── Sidebar structure (2026-09-07) ────────────────────────────────────────────
// Six domains, each a verb for what the operator is doing, with headed subsections.
// "Create …" and "Help" are page-level actions, not places, so they are not menu items.
// The older per-area item arrays and getActive*MenuItem helpers above remain for page tab bars.

function domain(
  id: string,
  label: string,
  iconComponent: any,
  basePaths: string[],
  subsections: NavigationSubsection[],
): NavigationSection {
  return { id, label, iconComponent, basePaths, subsections, items: subsections.flatMap((g) => g.items) };
}

const buildSection = domain("build", "Build", Hammer,
  ["/dynamic-entities", "/dynamic-endpoints", "/dynamic-resource-docs", "/glossary-items", "/integration", "/json-schema-validations", "/app-studio", "/reports"],
  [
    { label: "Dynamic Entities", items: [
      { href: "/dynamic-entities/system?level=system", label: "System", iconComponent: Box },
      { href: "/dynamic-entities/system?level=bank", label: "Bank", iconComponent: Building },
      { href: "/dynamic-entities/system?level=both", label: "System + Bank", iconComponent: Box },
      { href: "/dynamic-entities/personal", label: "Personal", iconComponent: UserRound },
      { href: "/dynamic-entities/diagnostics", label: "Diagnostics", iconComponent: Stethoscope },
    ] },
    { label: "Endpoints", items: [
      { href: "/dynamic-endpoints/system", label: "System", iconComponent: Plug },
      { href: "/dynamic-endpoints/bank", label: "Bank", iconComponent: Building },
    ] },
    { label: "Resource Docs", items: [
      { href: "/dynamic-resource-docs/system", label: "Dynamic Resource Docs", iconComponent: FileText },
    ] },
    { label: "Glossary", items: [
      { href: "/glossary-items", label: "Dynamic Glossary Items", iconComponent: BookOpen },
    ] },
    { label: "Routing", items: [
      { href: "/integration/method-routings", label: "Method Routings", iconComponent: Route },
    ] },
    { label: "Validation", items: [
      { href: "/json-schema-validations", label: "JSON Schema Validations", iconComponent: Braces },
    ] },
    { label: "Apps", items: [
      { href: "/app-studio", label: "App Studio", iconComponent: Smartphone },
      { href: "/app-studio/blocks", label: "Page Blocks", iconComponent: LayoutTemplate },
      { href: "/reports", label: "Reports", iconComponent: FileSpreadsheet },
    ] },
  ]);

const messagingSection = domain("messaging", "Messaging", MessagesSquare,
  ["/chat-rooms", "/system/signal-publish", "/system/signal-channels", "/system/signal-channels-stats"],
  [
    { label: "Chat", items: [
      { href: "/chat-rooms/system", label: "System", iconComponent: MessageSquare },
      { href: "/chat-rooms/bank", label: "Bank", iconComponent: Building },
    ] },
    { label: "Signals", items: [
      { href: "/system/signal-publish", label: "Publish", iconComponent: Radio },
      { href: "/system/signal-channels", label: "Signal Channels", iconComponent: Waves },
      { href: "/system/signal-channels-stats", label: "Signal Stats", iconComponent: BarChart3 },
    ] },
  ]);

const governSection = domain("govern", "Govern", Shield,
  ["/users", "/customers", "/consumers", "/rbac", "/abac", "/account-access", "/mandates"],
  [
    { label: "Identity", items: [
      { href: "/users", label: "Users", iconComponent: Users },
      { href: "/customers/individual", label: "Individual Customers", iconComponent: UserRound },
      { href: "/customers/corporate", label: "Corporate Customers", iconComponent: Building2 },
      { href: "/customers/account-links", label: "Account Links", iconComponent: Link },
      { href: "/customers/graph", label: "Customer Graph", iconComponent: GitBranch },
    ] },
    { label: "Consumers", items: [
      { href: "/consumers", label: "Consumers", iconComponent: KeyRound },
    ] },
    { label: "Roles", items: [
      { href: "/rbac/roles", label: "Roles", iconComponent: Shield },
      { href: "/rbac/entitlements", label: "Entitlements", iconComponent: FileCheck },
      { href: "/rbac/entitlements/bulk-grant", label: "Bulk Grant", iconComponent: Plus },
      { href: "/rbac/entitlements/bulk-revoke", label: "Bulk Revoke", iconComponent: ShieldOff },
      { href: "/rbac/entitlement-requests", label: "Entitlement Requests", iconComponent: FileSignature },
      { href: "/rbac/groups", label: "Groups", iconComponent: Users },
      { href: "/rbac/memberships", label: "Memberships", iconComponent: IdCardLanyard },
    ] },
    { label: "Rules", items: [
      { href: "/abac/rules", label: "ABAC Rules", iconComponent: Lock },
      { href: "/users?role_name=CanExecuteAbacRule", label: "ABAC Users", iconComponent: Users },
    ] },
    { label: "Account Access", items: [
      { href: "/account-access/system-views", label: "System Views", iconComponent: Eye },
      { href: "/account-access/custom-views", label: "Custom Views", iconComponent: Eye },
      { href: "/account-access/view-permissions", label: "View Permissions", iconComponent: FileCheck },
      { href: "/account-access/account-directory", label: "Account Directory", iconComponent: FolderOpen },
      { href: "/mandates", label: "Mandates", iconComponent: FileSignature },
    ] },
  ]);

const observeSection = domain("observe", "Observe", Activity,
  ["/system-activity-dashboard", "/metrics", "/aggregate-metrics-live", "/aggregate-metrics-trends", "/connector-metrics", "/connector-traces", "/connector-counts", "/metrics-diagnostics", "/system/log-cache", "/system/migrations"],
  [
    { label: "Dashboard", items: [
      { href: "/system-activity-dashboard", label: "Dashboard", iconComponent: LayoutDashboard },
    ] },
    { label: "API", items: [
      { href: "/metrics", label: "API Metrics", iconComponent: BarChart3 },
      { href: "/aggregate-metrics-live", label: "Live Aggregate Metrics", iconComponent: Zap },
      { href: "/aggregate-metrics-trends", label: "Aggregate Metrics Over Time", iconComponent: BarChart3 },
    ] },
    { label: "Connectors", items: [
      { href: "/connector-metrics", label: "Connector Metrics", iconComponent: Plug },
      { href: "/connector-traces", label: "Connector Traces", iconComponent: GitBranch },
      { href: "/connector-counts", label: "Connector Counts", iconComponent: Hash },
    ] },
    { label: "Tooling", items: [
      { href: "/metrics-diagnostics", label: "Diagnostics", iconComponent: Stethoscope },
      { href: "/system/log-cache", label: "Log Cache", iconComponent: Database },
      { href: "/system/migrations", label: "Migrations", iconComponent: GitBranch },
    ] },
  ]);

const operateSection = domain("operate", "Operate", Server,
  ["/system", "/metrics-archive-run"],
  [
    { label: "Health", items: [
      { href: "/system/cache", label: "Cache", iconComponent: HardDrive },
      { href: "/system/database-pool", label: "Database Pool", iconComponent: Database },
      { href: "/system/scheduler-job-locks", label: "Scheduler Job Locks", iconComponent: Clock },
      { href: "/system/rate-limiting", label: "Rate Limiting", iconComponent: Gauge },
      { href: "/system/self-test-emails", label: "Self Test Email", iconComponent: Mail },
    ] },
    { label: "Configuration", items: [
      { href: "/system/config-props", label: "Config Props", iconComponent: Settings },
      { href: "/system/webui-props", label: "WebUI Props", iconComponent: AppWindow },
      { href: "/system/features", label: "Features", iconComponent: ToggleLeft },
    ] },
    { label: "Jobs", items: [
      { href: "/metrics-archive-run", label: "Trigger Archive Run", iconComponent: Play },
    ] },
  ]);

const catalogueSection = domain("catalogue", "Catalogue", Library,
  ["/banks", "/products", "/system/featured-collections", "/management-docs", "/developer-faq", "/glossary", "/message-docs"],
  [
    { label: "Banks", items: [
      { href: "/banks", label: "Banks", iconComponent: Building2 },
    ] },
    { label: "Products", items: [
      { href: "/products/financial", label: "Financial Products", iconComponent: Banknote },
      { href: "/products/financial/all-banks", label: "Financial Products at All Banks", iconComponent: Landmark },
      { href: "/products/collections", label: "Product Collections", iconComponent: FolderOpen },
    ] },
    { label: "API Products", items: [
      { href: "/products", label: "API Products", iconComponent: Package },
      { href: "/products/bootstrap", label: "Bootstrap", iconComponent: Rocket },
    ] },
    { label: "Collections", items: [
      { href: "/system/featured-collections", label: "Featured Collections", iconComponent: Star },
    ] },
    { label: "Reference", items: [
      { href: "/glossary", label: "Glossary", iconComponent: BookOpen },
      { href: "/message-docs", label: "Message Docs", iconComponent: MessageSquare },
      { href: "/management-docs/consumers", label: "Consumers Docs", iconComponent: BookOpen },
      { href: "/management-docs/users", label: "Users Docs", iconComponent: BookOpen },
      { href: "/management-docs/entitlements", label: "Entitlements Docs", iconComponent: BookOpen },
      { href: "/management-docs/chat-rooms", label: "Chat Rooms Docs", iconComponent: BookOpen },
      { href: "/developer-faq", label: "Developer FAQ", iconComponent: CircleHelp },
    ] },
  ]);

export const navSections: NavigationSection[] = [
  { id: "my-account", label: "My Profile", iconComponent: User, items: myAccountItems, basePaths: ["/user", "/account-access/accounts"] },
  buildSection,
  messagingSection,
  governSection,
  observeSection,
  operateSection,
  catalogueSection,
];

/**
 * The section that owns `pathname`: the one whose matching base path is longest, so
 * /system/signal-publish belongs to Messaging rather than Operate, and /account-access/accounts
 * to My Profile rather than Govern.
 */
export function findActiveSection(pathname: string): NavigationSection | undefined {
  let best: { section: NavigationSection; len: number } | undefined;
  for (const section of navSections) {
    for (const bp of section.basePaths) {
      if ((pathname === bp || pathname.startsWith(bp + "/")) && (!best || bp.length > best.len)) {
        best = { section, len: bp.length };
      }
    }
  }
  return best?.section;
}
