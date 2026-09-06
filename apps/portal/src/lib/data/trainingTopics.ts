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
// GENERATED from for_dylan_training.md (repo root) — regenerate rather than hand-editing topic text.
// Section/topic ids are stable slugs; TrainingProgress records reference them, so avoid renaming ids.

export interface TrainingTopic {
	id: string;
	title: string;
	summary: string;
}

export interface TrainingSection {
	id: string;
	title: string;
	audience: string;
	topics: TrainingTopic[];
}

export const trainingSections: TrainingSection[] = [
	{
		id: "api-portal",
		title: "API Portal",
		audience: "developers & API consumers — follows the Portal top-level menu.",
		topics: [
			{
				id: "registration-and-login",
				title: "Registration & login",
				summary: "Creating an account, signing in via OIDC, session behaviour across Portal / Manager / Explorer."
			},
			{
				id: "get-api-key",
				title: "Get API Key",
				summary: "Registering a consumer (application): app name, redirect URLs, receiving the consumer key & secret, where the key is used."
			},
			{
				id: "developers-hub",
				title: "Developers hub",
				summary: "Documentation links, the MCP server entry, and Opey — the built-in AI chat assistant."
			},
			{
				id: "api-products-and-subscriptions",
				title: "API Products & Subscriptions",
				summary: "Browsing the product catalogue, subscribing to a product, the checkout flow, managing active subscriptions."
			},
			{
				id: "featured-and-financial-products",
				title: "Featured & Financial Products",
				summary: "Curated (featured) API collections and the bank-side financial product catalogue."
			},
			{
				id: "my-account",
				title: "My Account",
				summary: "Profile, My Data, Personal Data Fields, Entitlements, Consumers (applications), My API Collections."
			},
			{
				id: "accounts-and-activity-dashboard",
				title: "Accounts & Activity Dashboard",
				summary: "Viewing your bank accounts and recent activity; the dashboard of API calls you have made."
			},
			{
				id: "managing-consents",
				title: "Managing consents",
				summary: "Listing, inspecting and revoking consents from `/user/consents`; consent expiry and reuse."
			},
			{
				id: "consent-flows-in-depth",
				title: "Consent flows in depth",
				summary: "The OBP consent flow end to end: consent request, SCA/OTP confirmation, redirect handling, calling the API with the consent, expiry and reuse. Berlin Group and UK Open Banking flows as an overview — see API Standards."
			},
			{
				id: "onboarding",
				title: "Onboarding",
				summary: "User auth-context update requests and their OTP confirmation — linking a login to a customer."
			}
		]
	},
	{
		id: "api-manager",
		title: "API Manager",
		audience: "bank admins & operators — follows the Manager sidebar sections.",
		topics: [
			{
				id: "orientation-and-my-profile",
				title: "Orientation & My Profile",
				summary: "Logging in, the current-bank picker, profile, own consents, entitlements, accounts and collections; the site map."
			},
			{
				id: "banks",
				title: "Banks",
				summary: "Listing and creating banks; bank-level vs system-level scope as it applies across every other section."
			},
			{
				id: "users",
				title: "Users",
				summary: "Searching users, inspecting and unlocking accounts, user invitations."
			},
			{
				id: "rbac",
				title: "RBAC",
				summary: "Roles catalogue, granting entitlements (single, bulk grant, bulk revoke), groups & memberships, entitlement requests."
			},
			{
				id: "abac",
				title: "ABAC",
				summary: "Attribute-based access control: writing rules and managing ABAC users."
			},
			{
				id: "consumers",
				title: "Consumers",
				summary: "Reviewing and enabling/disabling API keys, redirect URLs, per-consumer limits."
			},
			{
				id: "customers",
				title: "Customers",
				summary: "Individual and corporate customers, customer–account links, the customer graph."
			},
			{
				id: "account-access-and-views",
				title: "Account Access & Views",
				summary: "System views vs custom views, view permissions, the account directory, mandates."
			},
			{
				id: "metrics",
				title: "Metrics",
				summary: "The activity dashboard, API metrics, live and over-time aggregates, connector metrics / traces / counts, diagnostics, archive runs."
			},
			{
				id: "system-administration",
				title: "System administration",
				summary: "Cache, config props, database pool, feature flags, migrations, scheduler job locks, WebUI props, self-test email."
			},
			{
				id: "signals",
				title: "Signals",
				summary: "Publishing signals, signal channels, channel statistics."
			},
			{
				id: "integration",
				title: "Integration",
				summary: "Method routings — directing API methods to connectors and back-end adapters."
			},
			{
				id: "dynamic-entities-endpoints-and-resource-docs",
				title: "Dynamic Entities, Endpoints & Resource Docs",
				summary: "Extending the API without code: entity scopes (system, bank, personal), dynamic endpoints from Swagger, authoring resource docs — including Opey-assisted form filling."
			},
			{
				id: "product-management",
				title: "Product management",
				summary: "API products, bootstrap, featured collections; financial products and product collections per bank."
			},
			{
				id: "chat-rooms-and-management-docs",
				title: "Chat Rooms & Management Docs",
				summary: "Administering chat rooms; where the management documentation lives."
			}
		]
	},
	{
		id: "api-explorer",
		title: "API Explorer",
		audience: "developers exploring the API surface.",
		topics: [
			{
				id: "navigating-the-catalogue",
				title: "Navigating the catalogue",
				summary: "API versions and standards (OBP, Berlin Group, UK Open Banking), browsing by tag, searching endpoints."
			},
			{
				id: "reading-resource-docs",
				title: "Reading resource docs",
				summary: "Request/response examples, typed fields, required roles and views per endpoint, possible errors."
			},
			{
				id: "trying-endpoints-live",
				title: "Trying endpoints live",
				summary: "Logging in, filling path parameters and request bodies, executing calls against the sandbox, reading responses."
			},
			{
				id: "glossary-and-message-docs",
				title: "Glossary & message docs",
				summary: "The OBP glossary of terms; connector message docs for back-end integrators."
			},
			{
				id: "api-collections",
				title: "API collections",
				summary: "Curating sets of endpoints into collections and sharing them (also surfaced in Portal and Manager)."
			}
		]
	},
	{
		id: "api-explorer-search-and-swagger-export",
		title: "API Explorer Search & Swagger Export",
		audience: "developers finding endpoints fast and taking the API definition elsewhere.",
		topics: [
			{
				id: "search-techniques",
				title: "Search techniques",
				summary: "Searching across endpoint names, summaries and descriptions; narrowing by version, standard and tag; finding an endpoint from a half-remembered field name."
			},
			{
				id: "finding-by-role-and-requirement",
				title: "Finding by role & requirement",
				summary: "Locating endpoints by the role they require — useful when working backwards from an entitlement request."
			},
			{
				id: "swagger-openapi-export",
				title: "Swagger / OpenAPI export",
				summary: "Exporting resource docs as a Swagger definition: per version, per tag, or for a curated API collection."
			},
			{
				id: "using-the-export",
				title: "Using the export",
				summary: "Importing the Swagger into Postman or code generators; generating client SDKs; sharing a scoped definition with partners."
			},
			{
				id: "round-tripping-to-dynamic-endpoints",
				title: "Round-tripping to Dynamic Endpoints",
				summary: "Feeding an exported (or edited) Swagger back into the API Manager to create dynamic endpoints — the export as a starting template."
			},
			{
				id: "keeping-exports-current",
				title: "Keeping exports current",
				summary: "Regenerating after upgrades or dynamic changes; versioning exported definitions alongside integration code."
			}
		]
	},
	{
		id: "obp-mcp",
		title: "OBP-MCP",
		audience: "developers connecting AI clients to OBP.",
		topics: [
			{
				id: "mcp-concepts",
				title: "MCP concepts",
				summary: "What the Model Context Protocol is and why a bank exposes an MCP server alongside its REST API."
			},
			{
				id: "connecting-a-client",
				title: "Connecting a client",
				summary: "Pointing Claude or another MCP client at the server; how the Portal advertises the MCP URL via the app directory."
			},
			{
				id: "authentication",
				title: "Authentication",
				summary: "The consent-first model: consents and service tokens instead of pasting bearer tokens into AI tools; consent scope and expiry."
			},
			{
				id: "available-tools",
				title: "Available tools",
				summary: "`call_obp_api`, `get_endpoint_schema`, endpoint tags, glossary lookups — and how an assistant chains them."
			},
			{
				id: "security-and-governance",
				title: "Security & governance",
				summary: "Entitlements enforced through the consent, auditing MCP traffic in metrics (auth type), revoking access."
			}
		]
	},
	{
		id: "opey",
		title: "Opey",
		audience: "everyone using the Portal or Manager — the built-in chat assistant.",
		topics: [
			{
				id: "what-opey-is",
				title: "What Opey is",
				summary: "The AI assistant embedded in the Portal and Manager; what it can and cannot do; where to find it (`/user/chat` and the chat widget)."
			},
			{
				id: "sessions-and-chat-rooms",
				title: "Sessions & chat rooms",
				summary: "Starting a conversation, human-friendly room names, revisiting past rooms, unread indicators."
			},
			{
				id: "authentication-and-consents",
				title: "Authentication & consents",
				summary: "The consent-first model: Opey acts on your behalf through a consent, never with your login token; viewing and revoking the consent it uses."
			},
			{
				id: "asking-about-the-api",
				title: "Asking about the API",
				summary: "Finding endpoints, explaining glossary terms, drafting example requests — how Opey uses the MCP tools under the hood."
			},
			{
				id: "making-calls-and-tool-messages",
				title: "Making calls & tool messages",
				summary: "Reading tool-call cards in the chat: OBP API requests and responses, what ran and with which parameters."
			},
			{
				id: "form-filling",
				title: "Form filling",
				summary: "Letting Opey fill Manager forms for you (e.g. dynamic resource docs): how the suggestion appears, reviewing before applying."
			},
			{
				id: "administration",
				title: "Administration",
				summary: "The Chat Rooms section of the Manager: browsing rooms, moderation, and auditing Opey's API traffic in metrics."
			}
		]
	},
	{
		id: "obp-api",
		title: "OBP-API",
		audience: "back-end developers & integrators.",
		topics: [
			{
				id: "architecture-and-versions",
				title: "Architecture & versions",
				summary: "The version tree (v5.1, v6, v7), stable vs bleeding-edge, standards support, how the frontends sit on top."
			},
			{
				id: "authentication",
				title: "Authentication",
				summary: "Direct Login, OAuth2/OIDC, consents — including how a consent executes as its own (shadow) user."
			},
			{
				id: "roles-and-entitlements",
				title: "Roles & entitlements",
				summary: "The role model, system vs bank roles, granting via API, entitlement requests."
			},
			{
				id: "views-and-account-access",
				title: "Views & account access",
				summary: "The views system: system and custom views, permissions, granting account access to other users."
			},
			{
				id: "core-banking-model",
				title: "Core banking model",
				summary: "Banks, accounts, transactions, customers, counterparties; loading sandbox data."
			},
			{
				id: "connectors-and-adapters",
				title: "Connectors & adapters",
				summary: "Connecting to core banking via Kafka and other adapters; method routings; connector metrics and traces."
			},
			{
				id: "dynamic-extension",
				title: "Dynamic extension",
				summary: "Dynamic entities, endpoints, resource docs, message docs and connector methods from the API side — see the Dynamic Extension section."
			},
			{
				id: "metrics-limits-and-caching",
				title: "Metrics, limits & caching",
				summary: "Metrics endpoints, rate limiting, response caching and how query parameters affect cache hits."
			},
			{
				id: "webhooks-and-eventing",
				title: "Webhooks & eventing",
				summary: "Account webhooks and outbound notifications."
			},
			{
				id: "the-apps-directory",
				title: "The /apps directory",
				summary: "The `/apps` page: how an OBP instance advertises its apps and services (Portal, Explorer, MCP, …) so users and frontends can discover them."
			},
			{
				id: "deployment-and-props",
				title: "Deployment & props",
				summary: "Building and running, the props configuration system, health/readiness, logging."
			}
		]
	},
	{
		id: "authentication-methods",
		title: "Authentication Methods",
		audience: "everyone building against or operating OBP — deep dive on the Authentication row in the OBP-API section.",
		topics: [
			{
				id: "choosing-a-method",
				title: "Choosing a method",
				summary: "Which authentication method suits which client: interactive apps, server-to-server, AI assistants, testing."
			},
			{
				id: "direct-login",
				title: "Direct Login",
				summary: "Token from username + password + consumer key; convenient for development and scripts; why it is unsuitable for third-party apps."
			},
			{
				id: "oauth2-oidc",
				title: "OAuth2 / OIDC",
				summary: "Authorization code with PKCE via OBP-OIDC or Keycloak; access tokens on API calls; token expiry and refresh."
			},
			{
				id: "oauth-1-0a-legacy",
				title: "OAuth 1.0a (legacy)",
				summary: "Where it still appears in older integrations and how to migrate away."
			},
			{
				id: "consents",
				title: "Consents",
				summary: "The OBP consent model: consent requests, SCA/OTP confirmation, calling the API with a consent; how a consent executes as its own user; expiry and reuse."
			},
			{
				id: "consent-first-for-ai-clients",
				title: "Consent-first for AI clients",
				summary: "Service tokens for Opey and MCP so the user's bearer token never leaves the Portal; scoping and revoking assistant access."
			},
			{
				id: "gateway-login-dauth",
				title: "Gateway login / DAuth",
				summary: "Trusting an upstream gateway or core-banking-authenticated identity; when a bank fronts OBP with its own auth."
			},
			{
				id: "frontend-sessions",
				title: "Frontend sessions",
				summary: "How Portal/Manager login sessions relate to the tokens used against the API; single sign-on across the apps."
			},
			{
				id: "auditing-authentication",
				title: "Auditing authentication",
				summary: "Seeing which method each call used (auth type in metrics); spotting anomalies; policies on allowed methods per environment."
			}
		]
	},
	{
		id: "views-and-data-access",
		title: "Views & Data Access",
		audience: "admins, product owners & developers — who can see and do what on an account.",
		topics: [
			{
				id: "the-views-concept",
				title: "The views concept",
				summary: "A view is a per-account lens controlling what a user can see and do on that account; why this is central to OBP data access."
			},
			{
				id: "system-vs-custom-views",
				title: "System vs custom views",
				summary: "The built-in system views (e.g. owner) vs custom views created for specific purposes; managing both in the API Manager."
			},
			{
				id: "view-permissions",
				title: "View permissions",
				summary: "The fine-grained flags on a view: seeing balances and transaction amounts, counterparty details, adding comments and tags, initiating payments."
			},
			{
				id: "granting-and-revoking-access",
				title: "Granting & revoking access",
				summary: "Sharing an account with another user through a view; the account directory; removing access cleanly."
			},
			{
				id: "views-and-consents",
				title: "Views & consents",
				summary: "How third-party consent access maps onto views — what an account-information consumer actually sees."
			},
			{
				id: "personas-in-practice",
				title: "Personas in practice",
				summary: "Different views over the same corporate account: e.g. CFO, Treasurer, Accounts Payable Clerk and Auditor each seeing a different slice."
			},
			{
				id: "views-vs-entitlements",
				title: "Views vs entitlements",
				summary: "Roles/entitlements gate endpoints; views gate account data — how the two combine to answer \"who can see what\"."
			},
			{
				id: "auditing-data-access",
				title: "Auditing data access",
				summary: "Reviewing view permissions in the Manager; using metrics to see who accessed which accounts."
			}
		]
	},
	{
		id: "api-products-and-collections",
		title: "API Products & Collections",
		audience: "product owners, admins & developers — packaging the API for consumption.",
		topics: [
			{
				id: "the-concept-map",
				title: "The concept map",
				summary: "API products vs API collections vs featured collections — which is which, and how they relate to subscriptions and entitlements."
			},
			{
				id: "defining-an-api-product",
				title: "Defining an API product",
				summary: "Creating a product in the Manager: which endpoints it bundles, descriptions and terms; the bootstrap tool for standing up a starter catalogue."
			},
			{
				id: "featuring-and-discovery",
				title: "Featuring & discovery",
				summary: "Featured collections and how products surface on the Portal's Featured and API Products pages; writing product pages developers actually read."
			},
			{
				id: "subscribing-to-a-product",
				title: "Subscribing to a product",
				summary: "The developer journey: Get API Key → subscribe → checkout; what a subscription grants (entitlements, rate limits, endpoint access) and what lapsing revokes."
			},
			{
				id: "api-collections",
				title: "API collections",
				summary: "Personal collections of endpoints in the Portal and Explorer: curating, sharing with a team, using a collection as a partner-facing API surface."
			},
			{
				id: "collections-in-the-explorer",
				title: "Collections in the Explorer",
				summary: "Browsing by collection; exporting a collection as Swagger for Postman, SDK generation or partner handover."
			},
			{
				id: "managing-in-the-manager",
				title: "Managing in the Manager",
				summary: "The API Products section (products, bootstrap, help) and Featured Collections; keeping the catalogue tidy across environments."
			}
		]
	},
	{
		id: "financial-products",
		title: "Financial Products",
		audience: "bank product teams & developers — the bank's own catalogue exposed through the API.",
		topics: [
			{
				id: "what-financial-products-are",
				title: "What financial products are",
				summary: "The bank's catalogue — current accounts, savings, loans, cards — modelled in OBP per bank, distinct from API products."
			},
			{
				id: "the-product-model",
				title: "The product model",
				summary: "Product codes, names, attributes, more-info links; parent/child product relationships."
			},
			{
				id: "product-collections",
				title: "Product collections",
				summary: "Grouping financial products into collections for marketing or channel purposes."
			},
			{
				id: "managing-per-bank",
				title: "Managing per bank",
				summary: "The Manager's Financial Products section: products at one bank, across all banks, and their collections."
			},
			{
				id: "portal-presentation",
				title: "Portal presentation",
				summary: "The Portal's Financial Products page: what end users and developers see, and where the data comes from."
			},
			{
				id: "api-access",
				title: "API access",
				summary: "The financial products endpoints: reading the catalogue and attributes; using products in onboarding and comparison journeys."
			}
		]
	},
	{
		id: "api-standards",
		title: "API Standards",
		audience: "developers, product owners & compliance. The OBP standard in depth, including consent management; Berlin Group and UK Open Banking as an overview.",
		topics: [
			{
				id: "standards-landscape",
				title: "Standards landscape",
				summary: "Why open banking standards exist; PSD2 and its successors; the actor roles (ASPSP, AISP, PISP) and how they map to OBP concepts."
			},
			{
				id: "the-obp-standard",
				title: "The OBP standard",
				summary: "OBP's own API in depth: broader than the regulatory minimum (customers, products, entitlements, views, metrics, dynamic extension); consent management end to end; versioning across v5.1/v6/v7."
			},
			{
				id: "berlin-group-nextgenpsd2",
				title: "Berlin Group (NextGenPSD2)",
				summary: "Overview: AIS/PIS endpoints, consent model, SCA approaches — enough to know what exists and where the Portal's Berlin Group screens fit."
			},
			{
				id: "uk-open-banking",
				title: "UK Open Banking",
				summary: "Overview: account access consents, payment initiation, the Portal's UK consent screens — orientation, not depth."
			},
			{
				id: "vrp",
				title: "VRP",
				summary: "Variable recurring payments: consent parameters (limits, duration), sweeping vs non-sweeping, the Portal's VRP consent and OTP flows."
			},
			{
				id: "running-standards-side-by-side",
				title: "Running standards side by side",
				summary: "How multiple standards are served from one OBP instance over the same core model and accounts; picking versions in the API Explorer."
			},
			{
				id: "consent-models-compared",
				title: "Consent models compared",
				summary: "OBP consents vs Berlin Group vs UK: lifecycle, expiry, SCA, revocation — a map for anyone supporting third-party developers."
			},
			{
				id: "conformance-and-compliance",
				title: "Conformance & compliance",
				summary: "Testing against the standards in the sandbox, certification expectations, staying current as standards evolve."
			}
		]
	},
	{
		id: "connectors-adapters-and-caching",
		title: "Connectors, Adapters & Caching",
		audience: "back-end integrators connecting OBP to core banking — deep dive on the overview rows in the OBP-API section.",
		topics: [
			{
				id: "connector-architecture",
				title: "Connector architecture",
				summary: "What a connector is; the mapped (local database) connector vs remote connectors; how one instance can mix them."
			},
			{
				id: "adapter-patterns",
				title: "Adapter patterns",
				summary: "Talking to core banking via Kafka, REST and other transports; the outbound/inbound message model; where an adapter runs."
			},
			{
				id: "connector-message-docs",
				title: "Connector message docs",
				summary: "Reading the message docs in the API Explorer: OutBound/InBound message shapes, versioning, which messages an adapter must implement."
			},
			{
				id: "method-routings",
				title: "Method routings",
				summary: "Routing individual API methods to different connectors, per bank; fallbacks and ordering; managing routings in the API Manager."
			},
			{
				id: "caching-layers",
				title: "Caching layers",
				summary: "API response caching and how it is keyed on the full query (why timestamp parameters matter for cache hits); connector-level caching; TTLs."
			},
			{
				id: "cache-administration",
				title: "Cache administration",
				summary: "Inspecting and clearing caches from the Manager's System section; when clearing is safe and what it costs."
			},
			{
				id: "monitoring-connectors",
				title: "Monitoring connectors",
				summary: "Connector metrics, traces and counts in the Manager; separating API-layer latency from adapter/back-end latency."
			},
			{
				id: "building-an-adapter",
				title: "Building an adapter",
				summary: "Starting from a minimal message subset, iterating with the sandbox, testing against message docs, going to production — see the dedicated section below."
			}
		]
	},
	{
		id: "message-docs-and-adapter-development",
		title: "Message Docs & Adapter Development",
		audience: "core-banking integration teams — building and maintaining an adapter, hands on.",
		topics: [
			{
				id: "message-docs-anatomy",
				title: "Message Docs anatomy",
				summary: "The OutBound/InBound message pairs: request fields, example JSON, required vs optional data, where to browse them (API Explorer message docs)."
			},
			{
				id: "message-doc-versions",
				title: "Message doc versions",
				summary: "How message docs are versioned per connector; picking a version and staying compatible as OBP-API upgrades."
			},
			{
				id: "adapter-responsibilities",
				title: "Adapter responsibilities",
				summary: "What the adapter must do with each message: mapping to core-banking calls, filling inbound status and error codes, honouring identifiers."
			},
			{
				id: "choosing-a-transport",
				title: "Choosing a transport",
				summary: "Kafka (topics, partitions, consumer groups) vs REST and other adapter variants; latency, ordering and operational trade-offs."
			},
			{
				id: "minimal-viable-adapter",
				title: "Minimal viable adapter",
				summary: "The small message subset that gets a bank on the API (banks, accounts, transactions, customer lookups); proving it end to end in the sandbox."
			},
			{
				id: "incremental-rollout",
				title: "Incremental rollout",
				summary: "Using method routings to move endpoints from the mapped connector to the adapter one at a time, with fallbacks while the adapter matures."
			},
			{
				id: "error-handling-and-resilience",
				title: "Error handling & resilience",
				summary: "Timeouts, retries, inbound error codes surfacing as API errors; what the API caller sees when the back-end is down."
			},
			{
				id: "testing-an-adapter",
				title: "Testing an adapter",
				summary: "Message docs as the contract; integration tests against the sandbox; using connector diagnostics and traces to verify behaviour."
			},
			{
				id: "operating-in-production",
				title: "Operating in production",
				summary: "Deploying the adapter alongside OBP-API, scaling consumers, monitoring lag/latency, upgrade coordination with core banking."
			}
		]
	},
	{
		id: "dynamic-extension",
		title: "Dynamic Extension",
		audience: "admins & integrators — extending a running OBP instance without redeploying. Covers all five dynamic features: Dynamic Entities, Dynamic Endpoints, Dynamic Resource Docs, Dynamic Message Docs and Connector Methods (the \"dynamic connector\").",
		topics: [
			{
				id: "the-dynamic-extension-toolkit",
				title: "The dynamic-extension toolkit",
				summary: "The five features side by side and what each adds at runtime: new data models (Entities), new endpoints from Swagger (Endpoints), new documented endpoints with code (Resource Docs), new connector messages (Message Docs), new/overridden connector behaviour (Connector Methods)."
			},
			{
				id: "dynamic-entities",
				title: "Dynamic Entities",
				summary: "Defining a data model that instantly gets CRUD endpoints; system vs bank vs personal scope; entity diagnostics; cascade deletion."
			},
			{
				id: "dynamic-endpoints",
				title: "Dynamic Endpoints",
				summary: "Uploading a Swagger definition to create endpoints; pointing them at a backing host; per-user endpoint listings."
			},
			{
				id: "dynamic-resource-docs",
				title: "Dynamic Resource Docs",
				summary: "Authoring a fully documented endpoint including its implementation; Opey-assisted form filling in the Manager; system vs bank scope."
			},
			{
				id: "dynamic-message-docs",
				title: "Dynamic Message Docs",
				summary: "Defining new connector message shapes at runtime, so a dynamic endpoint or connector method can talk to an adapter that isn't in the static message docs."
			},
			{
				id: "connector-methods",
				title: "Connector Methods",
				summary: "Implementing or overriding individual connector methods with runtime code — the \"dynamic connector\"; when to use this vs a real adapter."
			},
			{
				id: "nmb-s-dynamic-endpoints-in-practice",
				title: "NMB's dynamic endpoints in practice",
				summary: "The bank's own dynamic endpoints as worked examples: how they were defined, browsing them in the Explorer, calling them, and maintaining them."
			},
			{
				id: "provenance-and-governance",
				title: "Provenance & governance",
				summary: "The provenance endpoints on resource docs, message docs and connector methods: who created what, reviewing runtime code, the roles required, and per-environment policies on allowing dynamic code at all."
			},
			{
				id: "managing-in-the-manager",
				title: "Managing in the Manager",
				summary: "The Dynamic Entities, Dynamic Endpoints and Dynamic Resource Docs sections; the current-bank picker and scope; what is API-only (message docs, connector methods)."
			}
		]
	},
	{
		id: "obp-oidc",
		title: "OBP-OIDC",
		audience: "operators & integrators.",
		topics: [
			{
				id: "role-in-the-stack",
				title: "Role in the stack",
				summary: "OBP's lightweight OIDC provider: what it does and when to choose it over Keycloak."
			},
			{
				id: "discovery-and-endpoints",
				title: "Discovery & endpoints",
				summary: "The `.well-known` configuration, authorization/token/userinfo endpoints, JWKS and key rotation."
			},
			{
				id: "client-registration",
				title: "Client registration",
				summary: "Registering Portal, Manager and Explorer as OIDC clients; redirect URIs and client secrets."
			},
			{
				id: "flows-and-tokens",
				title: "Flows & tokens",
				summary: "Authorization code with PKCE, ID vs access vs refresh tokens, expiry and refresh behaviour."
			},
			{
				id: "user-store",
				title: "User store",
				summary: "How OBP-OIDC shares users with OBP-API; account creation and validation."
			},
			{
				id: "operations",
				title: "Operations",
				summary: "Running and configuring the service, environment variables, logs and troubleshooting login failures."
			}
		]
	},
	{
		id: "keycloak",
		title: "Keycloak",
		audience: "operators running enterprise identity.",
		topics: [
			{
				id: "keycloak-vs-obp-oidc",
				title: "Keycloak vs OBP-OIDC",
				summary: "When to deploy full Keycloak: federation, MFA, enterprise policies, admin tooling."
			},
			{
				id: "realm-and-client-setup",
				title: "Realm & client setup",
				summary: "Creating a realm for OBP, registering the frontend apps as clients, redirect URIs, scopes."
			},
			{
				id: "users-and-federation",
				title: "Users & federation",
				summary: "Local users, LDAP/AD federation, social identity providers."
			},
			{
				id: "claims-and-user-mapping",
				title: "Claims & user mapping",
				summary: "Mapping Keycloak claims to OBP users; keeping usernames and emails consistent across the stack."
			},
			{
				id: "login-ux",
				title: "Login UX",
				summary: "Themes, required actions, OTP/MFA policies, password policies."
			},
			{
				id: "operations",
				title: "Operations",
				summary: "Running in production: databases, HA, token lifetimes, upgrades, exporting/importing realm config."
			}
		]
	},
	{
		id: "obp-stripe-subscriptions",
		title: "OBP Stripe (Subscriptions)",
		audience: "operators & product owners — monetising API products through subscriptions.",
		topics: [
			{
				id: "role-in-the-stack",
				title: "Role in the stack",
				summary: "How Stripe-backed subscriptions connect API products to paid access; where the Subscriptions and Checkout pages in the Portal fit."
			},
			{
				id: "products-and-pricing",
				title: "Products & pricing",
				summary: "Mapping OBP API products to Stripe products and prices; plans, tiers and currencies."
			},
			{
				id: "the-checkout-flow",
				title: "The checkout flow",
				summary: "From the Portal's product page through checkout to Stripe-hosted payment and back; what the developer sees at each step."
			},
			{
				id: "webhooks-and-state",
				title: "Webhooks & state",
				summary: "Stripe webhooks driving subscription state in OBP; handling payment success, failure and cancellation events reliably."
			},
			{
				id: "subscription-lifecycle",
				title: "Subscription lifecycle",
				summary: "Activation, renewal, cancellation and expiry; what appears under Subscriptions in the Portal and Manager."
			},
			{
				id: "access-on-subscribe",
				title: "Access on subscribe",
				summary: "What a subscription actually grants: entitlements, rate limits, product access — and what is revoked when it lapses."
			},
			{
				id: "test-vs-live-mode",
				title: "Test vs live mode",
				summary: "Stripe test keys and test cards for sandbox environments; the checklist for switching to live payments."
			},
			{
				id: "operations",
				title: "Operations",
				summary: "Monitoring webhook failures, reconciling Stripe against OBP records, refunds, using the Stripe dashboard alongside the Manager."
			}
		]
	},
	{
		id: "obp-sandbox-populator",
		title: "OBP Sandbox Populator",
		audience: "sandbox operators, demo builders & trainers.",
		topics: [
			{
				id: "purpose-and-access",
				title: "Purpose & access",
				summary: "Why a sandbox needs realistic data; reaching the Populator from the Portal menu; the entitlements it requires."
			},
			{
				id: "the-data-model",
				title: "The data model",
				summary: "What gets created and in what order: banks, users, customers, accounts, transactions, counterparties, products."
			},
			{
				id: "scenarios-and-personas",
				title: "Scenarios & personas",
				summary: "Seeding purposeful data sets — e.g. corporate-account demos with CFO / Treasurer / Accounts Payable Clerk / Auditor personas, entitlements and views included."
			},
			{
				id: "running-a-population",
				title: "Running a population",
				summary: "Configuring a run, executing it, monitoring progress, understanding partial failures."
			},
			{
				id: "verifying-the-result",
				title: "Verifying the result",
				summary: "Checking the seeded data through the API Explorer, Portal accounts pages and Manager customer/account views."
			},
			{
				id: "resetting-and-repeatability",
				title: "Resetting & repeatability",
				summary: "Safe re-runs, clearing demo data with the cascade-delete endpoints, and when only a database restore gives a full reset."
			}
		]
	},
	{
		id: "obp-end-to-end-testing",
		title: "OBP End-to-End Testing",
		audience: "developers & QA — the OBP-End-To-End-Testing repository.",
		topics: [
			{
				id: "purpose-and-repo-layout",
				title: "Purpose & repo layout",
				summary: "Why E2E tests live in their own repository rather than per app; how the suites are organised across Portal, Manager and Explorer."
			},
			{
				id: "playwright-fundamentals",
				title: "Playwright fundamentals",
				summary: "Browsers, fixtures, locators, assertions; the `data-testid` convention the frontends follow to keep selectors stable."
			},
			{
				id: "page-objects",
				title: "Page objects",
				summary: "The page-object pattern used in the repo: encapsulating navigation and interactions so tests read as user journeys."
			},
			{
				id: "dialogs-and-async-ui",
				title: "Dialogs & async UI",
				summary: "The DialogWatcher pattern for unexpected dialogs; waiting for SvelteKit hydration before interacting with a page."
			},
			{
				id: "environments-and-credentials",
				title: "Environments & credentials",
				summary: "Pointing suites at an environment: base URLs, test users, seeded data expectations (pairs with the Sandbox Populator)."
			},
			{
				id: "running-and-debugging",
				title: "Running & debugging",
				summary: "Running locally and in CI, headed vs headless, traces, screenshots and videos for diagnosing failures."
			},
			{
				id: "writing-a-new-test",
				title: "Writing a new test",
				summary: "From user story to test: choosing the journey, extending page objects, keeping tests independent and repeatable."
			}
		]
	},
	{
		id: "obp-load-tester",
		title: "OBP Load Tester",
		audience: "operators & performance engineers.",
		topics: [
			{
				id: "purpose-and-when-to-load-test",
				title: "Purpose & when to load test",
				summary: "What the load tester is for: capacity planning, regression checks before releases, validating a new environment."
			},
			{
				id: "scenarios",
				title: "Scenarios",
				summary: "Defining realistic journeys and endpoint mixes — login/consent, account & transaction reads, write operations — rather than hammering one endpoint."
			},
			{
				id: "configuration",
				title: "Configuration",
				summary: "Target environment, consumer keys and test users, concurrency, ramp-up and duration; keeping load tests away from production."
			},
			{
				id: "running-a-test",
				title: "Running a test",
				summary: "Executing a run, watching it live, stopping safely."
			},
			{
				id: "interpreting-results",
				title: "Interpreting results",
				summary: "Throughput, latency percentiles (p50/p95/p99), error rates; distinguishing API limits from back-end/connector limits."
			},
			{
				id: "rate-limiting-and-caching-effects",
				title: "Rate limiting & caching effects",
				summary: "How per-consumer rate limits and response caching shape the numbers; designing runs that measure what you intend."
			},
			{
				id: "correlating-with-obp-metrics",
				title: "Correlating with OBP metrics",
				summary: "Using the Manager's metrics, connector metrics and traces to find where time is spent during a run."
			}
		]
	},
	{
		id: "ci-cd-and-github-actions",
		title: "CI/CD & GitHub Actions",
		audience: "developers & DevOps — how the OBP repositories test and ship.",
		topics: [
			{
				id: "pipeline-overview",
				title: "Pipeline overview",
				summary: "What runs on push and pull request across the OBP repositories; the path from commit to deployed environment."
			},
			{
				id: "github-actions-basics",
				title: "GitHub Actions basics",
				summary: "Workflows, jobs, triggers, runners, caching, secrets and environment variables in `.github/workflows`."
			},
			{
				id: "unit-and-component-tests",
				title: "Unit & component tests",
				summary: "Running the frontend test suites (Vitest) and OBP-API test suites (Maven) locally and in CI; keeping them fast and deterministic."
			},
			{
				id: "static-checks",
				title: "Static checks",
				summary: "Type checking, linting and formatting gates; failing fast before expensive jobs."
			},
			{
				id: "building-and-publishing-images",
				title: "Building & publishing images",
				summary: "Docker builds in CI, tagging strategy, pushing to the registry."
			},
			{
				id: "e2e-tests-in-the-pipeline",
				title: "E2E tests in the pipeline",
				summary: "Running the Playwright end-to-end suites against a deployed or ephemeral environment; when to gate vs when to report."
			},
			{
				id: "deploy-on-main",
				title: "Deploy on main",
				summary: "The push-to-main auto-deploy flow; confirming the deployed build via the version endpoint after the pipeline finishes."
			},
			{
				id: "troubleshooting-failed-runs",
				title: "Troubleshooting failed runs",
				summary: "Reading workflow logs, downloading job artifacts (test reports, traces), re-running failed jobs, flaky-test hygiene."
			}
		]
	},
	{
		id: "technology-stacks",
		title: "Technology Stacks",
		audience: "developers & architects — what each component is built with.",
		topics: [
			{
				id: "api-portal-and-api-manager",
				title: "API Portal & API Manager",
				summary: "SvelteKit with Svelte 5, TypeScript, Tailwind CSS + Skeleton UI; monorepo with shared code in `packages/shared`; Vitest for unit tests; Node runtime; REST and gRPC to OBP-API."
			},
			{
				id: "api-explorer",
				title: "API Explorer",
				summary: "Vue 3 + TypeScript (API Explorer II), rendered from OBP resource docs."
			},
			{
				id: "obp-mcp",
				title: "OBP-MCP",
				summary: "Python with FastMCP (the MCP SDK); consent-first service-token authentication."
			},
			{
				id: "opey",
				title: "Opey",
				summary: "Python: FastAPI service running a LangChain/LangGraph agent with streaming responses; chat UI shipped as shared Svelte components in the frontends."
			},
			{
				id: "obp-api",
				title: "OBP-API",
				summary: "Scala / Java with http4s, built with Maven; relational database (e.g. PostgreSQL); Kafka and Akka for adapter transports."
			},
			{
				id: "obp-oidc",
				title: "OBP-OIDC",
				summary: "Scala (2.13) with http4s, built with Maven; shares the OBP user store."
			},
			{
				id: "keycloak",
				title: "Keycloak",
				summary: "Java (Quarkus distribution) with its own relational database."
			},
			{
				id: "obp-stripe",
				title: "OBP Stripe",
				summary: "Node.js server and client integrating Stripe Checkout subscriptions: checkout sessions and webhooks."
			},
			{
				id: "sandbox-populator",
				title: "Sandbox Populator",
				summary: "SvelteKit + TypeScript web app (with Python helper scripts) driving OBP-API endpoints to seed data."
			},
			{
				id: "end-to-end-testing",
				title: "End-to-End Testing",
				summary: "TypeScript + Playwright with the page-object pattern."
			},
			{
				id: "load-tester",
				title: "Load Tester",
				summary: "Go application generating scenario-driven load against OBP endpoints."
			},
			{
				id: "ci-cd-and-runtime",
				title: "CI/CD & runtime",
				summary: "GitHub Actions pipelines; Docker images; Kubernetes."
			}
		]
	},
	{
		id: "deployment-and-kubernetes",
		title: "Deployment & Kubernetes",
		audience: "DevOps & operators — cross-cutting, applies to the whole stack.",
		topics: [
			{
				id: "stack-topology",
				title: "Stack topology",
				summary: "How the components fit together in a deployment: OBP-API + database, the SvelteKit frontends, MCP server, identity provider (OBP-OIDC or Keycloak), API Explorer."
			},
			{
				id: "containerisation",
				title: "Containerisation",
				summary: "Building the Docker images, what must ship inside them (e.g. proto files for gRPC), image tagging and registries."
			},
			{
				id: "configuration-and-secrets",
				title: "Configuration & secrets",
				summary: "Environment variables vs OBP-API props, `PUBLIC_*` vars in the frontends, ConfigMaps and Secrets, per-environment overrides."
			},
			{
				id: "kubernetes-resources",
				title: "Kubernetes resources",
				summary: "Deployments, Services and Ingress for each component; namespaces and labelling conventions."
			},
			{
				id: "health-readiness-and-probes",
				title: "Health, readiness & probes",
				summary: "Liveness (`/health`) vs readiness (`/ready`) vs diagnostics (`/status`); why the liveness endpoint must stay simple and stable; designing dependency checks."
			},
			{
				id: "ci-cd-pipeline",
				title: "CI/CD pipeline",
				summary: "Push-to-main auto-deploy, pipeline stages, verifying the deployed build via the version endpoint before debugging."
			},
			{
				id: "tls-ingress-and-grpc",
				title: "TLS, ingress & gRPC",
				summary: "Certificates at the ingress, HTTP vs gRPC routing (gRPC over TLS on 443 via a dedicated subdomain), redirect URI hygiene for OIDC."
			},
			{
				id: "scaling-and-resources",
				title: "Scaling & resources",
				summary: "Replicas and HPA, resource requests/limits, JVM sizing for OBP-API, database connection pools."
			},
			{
				id: "observability",
				title: "Observability",
				summary: "Logs, API metrics as an ops signal, alerting on error rates and latency."
			},
			{
				id: "upgrades-and-rollbacks",
				title: "Upgrades & rollbacks",
				summary: "Rolling updates, coordinating OBP-API database migrations, environment promotion (sandbox → production)."
			}
		]
	}
];
