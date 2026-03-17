/**
 * Maps route patterns to human-readable page descriptions.
 * Used by the Opey Insight Bar to give Opey context about where the user is.
 */

const routeDescriptions: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /^\/banks\/create$/, description: "Create Bank" },
  { pattern: /^\/banks\/(?!create$)[^/]+/, description: "Bank" },
  { pattern: /^\/banks$/, description: "Banks list" },
  { pattern: /^\/users$/, description: "Users list" },
  { pattern: /^\/consumers$/, description: "API Consumers list" },
  { pattern: /^\/aggregate-metrics/, description: "Aggregate Metrics" },
  { pattern: /^\/connector-metrics/, description: "Connector Metrics" },
  { pattern: /^\/connector-traces/, description: "Connector Traces" },
  { pattern: /^\/connector-counts/, description: "Connector Counts" },
  { pattern: /^\/metrics/, description: "API Metrics" },
  { pattern: /^\/rbac\/entitlements\/create/, description: "Create Entitlement" },
  { pattern: /^\/rbac\/entitlements/, description: "Entitlements" },
  { pattern: /^\/rbac\/roles/, description: "Roles" },
  { pattern: /^\/rbac\/groups/, description: "Groups" },
  { pattern: /^\/rbac\/memberships/, description: "Memberships" },
  { pattern: /^\/rbac\/entitlement-requests/, description: "Entitlement Requests" },
  { pattern: /^\/rbac\/banks/, description: "RBAC Banks" },
  { pattern: /^\/system\/cache/, description: "System Cache" },
  { pattern: /^\/system\/config-props/, description: "System Config Props" },
  { pattern: /^\/system\/database-pool/, description: "Database Pool" },
  { pattern: /^\/system\/migrations/, description: "System Migrations" },
  { pattern: /^\/system\/webui-props/, description: "WebUI Props" },
  { pattern: /^\/system\/signal/, description: "Signals" },
  { pattern: /^\/system\//, description: "System settings" },
  { pattern: /^\/products\/financial/, description: "Financial Products" },
  { pattern: /^\/products\/collections/, description: "Product Collections" },
  { pattern: /^\/products\/bootstrap/, description: "Products Bootstrap" },
  { pattern: /^\/products/, description: "API Products" },
  { pattern: /^\/dynamic-entities\/diagnostics/, description: "Dynamic Entities Diagnostics" },
  { pattern: /^\/dynamic-entities\/personal/, description: "Personal Dynamic Entities" },
  { pattern: /^\/dynamic-entities/, description: "Dynamic Entities" },
  { pattern: /^\/dynamic-endpoints/, description: "Dynamic Endpoints" },
  { pattern: /^\/customers\/individual/, description: "Individual Customers" },
  { pattern: /^\/customers\/corporate/, description: "Corporate Customers" },
  { pattern: /^\/customers\/[^/]+\/[^/]+/, description: "Customer" },
  { pattern: /^\/customers/, description: "Customers" },
  { pattern: /^\/account-access\/system-views/, description: "System Views" },
  { pattern: /^\/account-access\/custom-views/, description: "Custom Views" },
  { pattern: /^\/account-access\/account-directory/, description: "Account Directory" },
  { pattern: /^\/account-access\/accounts/, description: "My Accounts" },
  { pattern: /^\/account-access/, description: "Account Access" },
  { pattern: /^\/user\/consents/, description: "My Consents" },
  { pattern: /^\/user\/entitlements/, description: "My Entitlements" },
  { pattern: /^\/user$/, description: "My Profile" },
  { pattern: /^\/abac/, description: "ABAC Rules" },
  { pattern: /^\/integration/, description: "Integration / Method Routings" },
  { pattern: /^\/api-collections/, description: "API Collections" },
  { pattern: /^\/site-map$/, description: "Site Map" },
  { pattern: /^\/about$/, description: "About" },
];

/**
 * Get a human-readable description of the current page for Opey context.
 */
export function describeRoute(pathname: string): string {
  const match = routeDescriptions.find((r) => r.pattern.test(pathname));
  return match ? match.description : pathname;
}
