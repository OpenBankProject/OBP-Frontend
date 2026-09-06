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
export interface BootstrapEndpoint {
  operation_id: string;
  summary: string;
}

export interface BootstrapProduct {
  id: string;
  product_code: string;
  name: string;
  description: string;
  capabilities: string[];
  monthly_subscription_amount: string;
  monthly_subscription_currency: string;
  per_second_call_limit: string;
  per_minute_call_limit: string;
  per_hour_call_limit: string;
  per_day_call_limit: string;
  per_week_call_limit: string;
  per_month_call_limit: string;
}

export interface BootstrapCollection {
  id: string;
  collection_name: string;
  description: string;
  functional_scope: string[];
  is_sharable: boolean;
  endpoints: BootstrapEndpoint[];
  products: BootstrapProduct[];
}

export const bootstrapJourneys: BootstrapCollection[] = [
  // ── 1. Account Intelligence & Enrichment ─────────────────────────────
  {
    id: "1",
    collection_name: "Account-Intelligence-Enrichment",
    description:
      "Rich account data with custom views, transaction & counterparty metadata, and tagging — powering PFM dashboards and spending analytics.",
    functional_scope: [
      "Account Data",
      "Balances",
      "Custom Views",
      "Transaction Metadata",
      "Counterparty Metadata",
    ],
    is_sharable: true,
    endpoints: [
      { operation_id: "OBPv4.0.0-getBanks", summary: "Get Banks" },
      { operation_id: "OBPv4.0.0-getPrivateAccountsAtOneBank", summary: "Get Accounts at Bank" },
      { operation_id: "OBPv4.0.0-getAccount", summary: "Get Account by Id" },
      { operation_id: "OBPv4.0.0-getAccountByAccountRouting", summary: "Get Account by Routing" },
      { operation_id: "OBPv4.0.0-getBalancesAtBank", summary: "Get Balances at Bank" },
      // Custom Views
      { operation_id: "OBPv5.0.0-getViewsForBankAccount", summary: "Get Views for Account" },
      { operation_id: "OBPv3.0.0-createViewForBankAccount", summary: "Create Custom View" },
      { operation_id: "OBPv3.0.0-updateViewForBankAccount", summary: "Update Custom View" },
      { operation_id: "OBPv5.1.0-grantUserAccessToViewById", summary: "Grant User Access to View" },
      // Transactions + Metadata
      { operation_id: "OBPv4.0.0-getTransactionsForBankAccount", summary: "Get Transactions for Account" },
      { operation_id: "OBPv4.0.0-getTransactionByIdForBankAccount", summary: "Get Transaction by Id" },
      { operation_id: "OBPv1.2.1-addTagForViewOnTransaction", summary: "Add Transaction Tag" },
      { operation_id: "OBPv1.2.1-getTagsForViewOnTransaction", summary: "Get Transaction Tags" },
      { operation_id: "OBPv1.2.1-addCommentForViewOnTransaction", summary: "Add Transaction Comment" },
      { operation_id: "OBPv1.2.1-getCommentsForViewOnTransaction", summary: "Get Transaction Comments" },
      { operation_id: "OBPv1.2.1-addTransactionNarrative", summary: "Add Transaction Narrative" },
      { operation_id: "OBPv1.2.1-getTransactionNarrative", summary: "Get Transaction Narrative" },
      // Counterparties
      { operation_id: "OBPv4.0.0-getExplicitCounterpartiesForAccount", summary: "Get Explicit Counterparties" },
      { operation_id: "OBPv4.0.0-createCounterparty", summary: "Create Counterparty (Explicit)" },
      { operation_id: "OBPv1.2.1-getOtherAccountMetadata", summary: "Get Counterparty Metadata" },
      // Account Metadata
      { operation_id: "OBPv4.0.0-addTagForViewOnAccount", summary: "Tag an Account" },
      { operation_id: "OBPv4.0.0-getTagsForViewOnAccount", summary: "Get Account Tags" },
    ],
    products: [
      {
        id: "1.1",
        product_code: "personal-financial-insights",
        name: "Personal Financial Insights",
        description:
          "Rich account, balance, and transaction data with tagging, comments and counterparty enrichment for consumer-facing PFM dashboards.",
        capabilities: [
          "Custom view creation & access control",
          "Transaction tagging, comments & narratives",
          "Counterparty metadata enrichment",
          "Account tagging & categorisation",
        ],
        monthly_subscription_amount: "50.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
      {
        id: "1.2",
        product_code: "sme-cash-flow-cockpit",
        name: "SME Cash-Flow Cockpit",
        description:
          "Multi-account cash-flow views with counterparty analysis, custom views and transaction annotation for SME treasury tools.",
        capabilities: [
          "Multi-account aggregation via custom views",
          "Counterparty creation & metadata lookup",
          "Transaction narrative & comment attachment",
          "View-based access control delegation",
        ],
        monthly_subscription_amount: "150.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },

  // ── 2. Lending, Credit & Account Applications ────────────────────────
  {
    id: "2",
    collection_name: "Lending-Credit-Account-Applications",
    description:
      "Credit decisioning with deep customer data — attributes, credit ratings, overviews, account links, standing orders, direct debits and account applications.",
    functional_scope: [
      "Customer 360",
      "Customer Attributes",
      "Standing Orders",
      "Direct Debits",
      "Account Applications",
      "KYC/AML",
    ],
    is_sharable: true,
    endpoints: [
      { operation_id: "OBPv4.0.0-getTransactionsForBankAccount", summary: "Get Transactions for Account" },
      { operation_id: "OBPv4.0.0-getCoreTransactionsForBankAccount", summary: "Get Core Transactions" },
      { operation_id: "OBPv4.0.0-getBalancesAtBank", summary: "Get Balances at Bank" },
      { operation_id: "OBPv4.0.0-getAccount", summary: "Get Account by Id" },
      { operation_id: "OBPv4.0.0-getAccountByAccountRouting", summary: "Get Account by Routing" },
      // Customer data & search
      { operation_id: "OBPv6.0.0-getCustomersAtOneBank", summary: "Get Customers at Bank" },
      { operation_id: "OBPv6.0.0-getCustomerByCustomerId", summary: "Get Customer by Id" },
      { operation_id: "OBPv6.0.0-getCustomerByCustomerNumber", summary: "Get Customer by Customer Number" },
      { operation_id: "OBPv4.0.0-getCustomersByCustomerPhoneNumber", summary: "Get Customers by Phone Number" },
      { operation_id: "OBPv6.0.0-getCustomersByLegalName", summary: "Get Customers by Legal Name" },
      { operation_id: "OBPv5.0.0-getCustomerOverview", summary: "Get Customer Overview" },
      { operation_id: "OBPv5.0.0-getCustomerOverviewFlat", summary: "Get Customer Overview Flat" },
      // Customer attributes & credit
      { operation_id: "OBPv4.0.0-getCustomerAttributes", summary: "Get Customer Attributes" },
      { operation_id: "OBPv4.0.0-createCustomerAttribute", summary: "Create Customer Attribute" },
      { operation_id: "OBPv3.1.0-updateCustomerCreditRatingAndSource", summary: "Update Customer Credit Rating" },
      { operation_id: "OBPv3.1.0-updateCustomerCreditLimit", summary: "Update Customer Credit Limit" },
      // Customer-Account links
      { operation_id: "OBPv5.0.0-getCustomerAccountLinksByCustomerId", summary: "Get Customer Account Links" },
      { operation_id: "OBPv5.0.0-getCustomerAccountLinksByBankIdAccountId", summary: "Get Account Links by Account" },
      // KYC
      { operation_id: "OBPv2.0.0-getKycDocuments", summary: "Get KYC Documents" },
      { operation_id: "OBPv2.0.0-getKycStatuses", summary: "Get KYC Statuses" },
      // Standing Orders & Direct Debits
      { operation_id: "OBPv4.0.0-createStandingOrder", summary: "Create Standing Order" },
      { operation_id: "OBPv4.0.0-createDirectDebit", summary: "Create Direct Debit" },
      // Account Applications
      { operation_id: "OBPv3.1.0-createAccountApplication", summary: "Create Account Application" },
      { operation_id: "OBPv3.1.0-getAccountApplications", summary: "Get Account Applications" },
      { operation_id: "OBPv3.1.0-updateAccountApplicationStatus", summary: "Update Account Application Status" },
    ],
    products: [
      {
        id: "2.1",
        product_code: "instant-credit-decisioning",
        name: "Instant Credit Decisioning",
        description:
          "Customer overview, credit rating, attributes, transaction analysis and standing order data for real-time affordability checks and credit scoring.",
        capabilities: [
          "Customer 360 overview (flat & nested)",
          "Credit rating & limit management",
          "Customer attribute-based scoring",
          "Standing order & direct debit visibility",
        ],
        monthly_subscription_amount: "200.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
      {
        id: "2.2",
        product_code: "relationship-based-pricing",
        name: "Relationship-Based Pricing Inputs",
        description:
          "Customer-account links, search by phone/name/number, KYC data and account applications for personalised pricing and loyalty tiers.",
        capabilities: [
          "Customer search (phone, name, number)",
          "Customer-account link traversal",
          "KYC document & status visibility",
          "Account application tracking",
        ],
        monthly_subscription_amount: "100.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },

  // ── 3. Payments, Treasury & Counterparties ───────────────────────────
  {
    id: "3",
    collection_name: "Payments-Treasury-Counterparties",
    description:
      "Full-spectrum payment initiation (SEPA, ACCOUNT, COUNTERPARTY, REFUND, CARD), firehose data, standing orders, webhooks and FX for corporate treasury.",
    functional_scope: [
      "Payment Initiation",
      "SEPA & Cross-border",
      "Standing Orders",
      "Firehose Data",
      "Webhooks",
      "FX",
    ],
    is_sharable: true,
    endpoints: [
      { operation_id: "OBPv4.0.0-getBanks", summary: "Get Banks" },
      { operation_id: "OBPv4.0.0-getPrivateAccountsAtOneBank", summary: "Get Accounts at Bank" },
      { operation_id: "OBPv4.0.0-getBalancesAtBank", summary: "Get Balances at Bank" },
      // Payment types
      { operation_id: "OBPv1.4.0-getTransactionRequestTypes", summary: "Get Transaction Request Types" },
      { operation_id: "OBPv4.0.0-createTransactionRequestAccount", summary: "Create Transaction Request (ACCOUNT)" },
      { operation_id: "OBPv4.0.0-createTransactionRequestSepa", summary: "Create Transaction Request (SEPA)" },
      { operation_id: "OBPv4.0.0-createTransactionRequestCounterparty", summary: "Create Transaction Request (COUNTERPARTY)" },
      { operation_id: "OBPv4.0.0-createTransactionRequestRefund", summary: "Create Transaction Request (REFUND)" },
      { operation_id: "OBPv4.0.0-createTransactionRequestCard", summary: "Create Transaction Request (CARD)" },
      { operation_id: "OBPv4.0.0-answerTransactionRequestChallenge", summary: "Answer Transaction Request Challenge" },
      { operation_id: "OBPv5.1.0-getTransactionRequests", summary: "Get Transaction Requests" },
      // Counterparties
      { operation_id: "OBPv4.0.0-getExplicitCounterpartiesForAccount", summary: "Get Explicit Counterparties" },
      { operation_id: "OBPv4.0.0-createCounterparty", summary: "Create Counterparty (Explicit)" },
      // Standing Orders & Direct Debits
      { operation_id: "OBPv4.0.0-createStandingOrder", summary: "Create Standing Order" },
      { operation_id: "OBPv4.0.0-createDirectDebit", summary: "Create Direct Debit" },
      // Firehose
      { operation_id: "OBPv4.0.0-getFirehoseAccountsAtOneBank", summary: "Get Firehose Accounts at Bank" },
      { operation_id: "OBPv3.0.0-getFirehoseTransactionsForBankAccount", summary: "Get Firehose Transactions" },
      // Webhooks
      { operation_id: "OBPv3.1.0-createAccountWebhook", summary: "Create Account Webhook" },
      { operation_id: "OBPv3.1.0-getAccountWebhooks", summary: "Get Account Webhooks" },
      { operation_id: "OBPv4.0.0-createBankAccountNotificationWebhook", summary: "Create Transaction Notification Webhook" },
      // FX
      { operation_id: "OBPv4.0.0-getCurrentFxRate", summary: "Get Current FX Rate" },
    ],
    products: [
      {
        id: "3.1",
        product_code: "corporate-treasury-dashboard",
        name: "Corporate Treasury Dashboard",
        description:
          "Multi-bank balance aggregation, full payment initiation (SEPA, COUNTERPARTY, REFUND), FX rates, webhooks and firehose data for corporate treasurers.",
        capabilities: [
          "SEPA & cross-border payment initiation",
          "Transaction challenge/SCA workflows",
          "Real-time webhooks on transactions",
          "Firehose account & transaction feeds",
        ],
        monthly_subscription_amount: "500.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
      {
        id: "3.2",
        product_code: "intra-group-liquidity",
        name: "Intra-Group Liquidity Intelligence",
        description:
          "Group-level liquidity views with standing orders, direct debits, counterparty management and card-based fund transfers.",
        capabilities: [
          "Standing order & direct debit management",
          "Card payment initiation",
          "Counterparty creation & management",
          "FX rate look-up",
        ],
        monthly_subscription_amount: "350.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },

  // ── 4. Partner, Ecosystem & Platform Extension ───────────────────────
  {
    id: "4",
    collection_name: "Partner-Ecosystem-Platform",
    description:
      "Dynamic entities, VRP consent, customer on-boarding, custom views, webhooks and consent workflows — enabling fintechs and internal teams to extend the platform.",
    functional_scope: [
      "Dynamic Entities",
      "Customer On-boarding",
      "VRP Consents",
      "Custom Views",
      "Webhooks",
      "Consent Lifecycle",
    ],
    is_sharable: true,
    endpoints: [
      { operation_id: "OBPv4.0.0-getPrivateAccountsAtOneBank", summary: "Get Accounts at Bank" },
      { operation_id: "OBPv4.0.0-getAccount", summary: "Get Account by Id" },
      { operation_id: "OBPv4.0.0-getBalancesAtBank", summary: "Get Balances at Bank" },
      { operation_id: "OBPv4.0.0-getTransactionsForBankAccount", summary: "Get Transactions for Account" },
      { operation_id: "OBPv4.0.0-createTransactionRequestAccount", summary: "Create Transaction Request (ACCOUNT)" },
      // Dynamic Entities
      { operation_id: "OBPv6.0.0-createBankLevelDynamicEntity", summary: "Create Bank Level Dynamic Entity" },
      { operation_id: "OBPv6.0.0-getBankLevelDynamicEntities", summary: "Get Bank Level Dynamic Entities" },
      { operation_id: "OBPv6.0.0-updateBankLevelDynamicEntity", summary: "Update Bank Level Dynamic Entity" },
      { operation_id: "OBPv6.0.0-getMyDynamicEntities", summary: "Get My Dynamic Entities" },
      // Connector Methods
      { operation_id: "OBPv4.0.0-createConnectorMethod", summary: "Create Connector Method" },
      { operation_id: "OBPv4.0.0-getAllConnectorMethods", summary: "Get All Connector Methods" },
      // Custom Views
      { operation_id: "OBPv3.0.0-createViewForBankAccount", summary: "Create Custom View" },
      { operation_id: "OBPv5.0.0-getViewsForBankAccount", summary: "Get Views for Account" },
      // VRP & Consent
      { operation_id: "OBPv5.1.0-createVRPConsentRequest", summary: "Create VRP Consent Request" },
      { operation_id: "OBPv5.0.0-createConsentRequest", summary: "Create Consent Request" },
      { operation_id: "OBPv5.0.0-getConsentRequest", summary: "Get Consent Request" },
      { operation_id: "OBPv5.0.0-createConsentByConsentRequestIdImplicit", summary: "Create Consent (IMPLICIT)" },
      // Customer on-boarding & management
      { operation_id: "OBPv6.0.0-createCustomer", summary: "Create Customer" },
      { operation_id: "OBPv3.1.0-createCustomerAddress", summary: "Create Customer Address" },
      { operation_id: "OBPv3.1.0-getCustomerAddresses", summary: "Get Customer Addresses" },
      { operation_id: "OBPv4.0.0-createUserCustomerLinks", summary: "Create User Customer Link" },
      { operation_id: "OBPv5.0.0-createCustomerAccountLink", summary: "Create Customer Account Link" },
      // Webhooks
      { operation_id: "OBPv3.1.0-createAccountWebhook", summary: "Create Account Webhook" },
      { operation_id: "OBPv3.1.0-getAccountWebhooks", summary: "Get Account Webhooks" },
      // JSON Schema Validations
      { operation_id: "OBPv4.0.0-createJsonSchemaValidation", summary: "Create JSON Schema Validation" },
      { operation_id: "OBPv4.0.0-getAllJsonSchemaValidations", summary: "Get All JSON Schema Validations" },
    ],
    products: [
      {
        id: "4.1",
        product_code: "fintech-fast-track",
        name: "Fintech Fast-Track",
        description:
          "Pre-packaged account, payment, consent and VRP APIs with full customer on-boarding, messaging, webhooks and custom views for rapid go-live.",
        capabilities: [
          "Customer creation with addresses & account linking",
          "User-customer link management",
          "VRP consent request workflows",
          "Webhook-driven event architecture",
        ],
        monthly_subscription_amount: "75.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
      {
        id: "4.2",
        product_code: "platform-extension-kit",
        name: "Platform Extension Kit",
        description:
          "Full platform extensibility — create dynamic entities, connector methods and JSON schema validations to tailor the API to your domain.",
        capabilities: [
          "Bank-level dynamic entity CRUD",
          "Connector method creation",
          "JSON schema validation rules",
        ],
        monthly_subscription_amount: "300.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },

  // ── 5. Compliance, Consent & Audit ───────────────────────────────────
  {
    id: "5",
    collection_name: "Compliance-Consent-Audit",
    description:
      "Full consent lifecycle (AIS, VRP), deep KYC/AML (checks, media, tax residence), user entitlements, view permissions, CRM events and firehose surveillance.",
    functional_scope: [
      "Consent Lifecycle",
      "VRP Consent",
      "KYC/AML Deep",
      "Tax Residence",
      "View Permissions",
      "Firehose Surveillance",
    ],
    is_sharable: true,
    endpoints: [
      // Consent lifecycle
      { operation_id: "OBPv5.1.0-getConsents", summary: "Get Consents" },
      { operation_id: "OBPv5.1.0-getConsentsAtBank", summary: "Get Consents at Bank" },
      { operation_id: "OBPv5.1.0-getMyConsents", summary: "Get My Consents" },
      { operation_id: "OBPv4.0.0-updateConsentStatus", summary: "Update Consent Status" },
      { operation_id: "OBPv5.1.0-revokeConsentAtBank", summary: "Revoke Consent at Bank" },
      { operation_id: "OBPv3.1.0-answerConsentChallenge", summary: "Answer Consent Challenge" },
      // VRP
      { operation_id: "OBPv5.1.0-createVRPConsentRequest", summary: "Create VRP Consent Request" },
      // KYC/AML deep
      { operation_id: "OBPv2.0.0-getKycDocuments", summary: "Get KYC Documents" },
      { operation_id: "OBPv2.0.0-getKycStatuses", summary: "Get KYC Statuses" },
      { operation_id: "OBPv2.0.0-getKycChecks", summary: "Get KYC Checks" },
      { operation_id: "OBPv2.0.0-getKycMedia", summary: "Get KYC Media" },
      { operation_id: "OBPv6.0.0-getCustomersAtOneBank", summary: "Get Customers at Bank" },
      { operation_id: "OBPv6.0.0-getCustomerByCustomerId", summary: "Get Customer by Id" },
      { operation_id: "OBPv4.0.0-getCustomerAttributes", summary: "Get Customer Attributes" },
      // Tax Residence
      { operation_id: "OBPv3.1.0-getTaxResidence", summary: "Get Tax Residences" },
      { operation_id: "OBPv3.1.0-createTaxResidence", summary: "Create Tax Residence" },
      // Customer-User links & CRM
      { operation_id: "OBPv4.0.0-getUserCustomerLinksByCustomerId", summary: "Get User Customer Links by Customer" },
      { operation_id: "OBPv4.0.0-getUserCustomerLinksByUserId", summary: "Get User Customer Links by User" },
      { operation_id: "OBPv1.4.0-getCrmEvents", summary: "Get CRM Events" },
      // Firehose customers
      { operation_id: "OBPv3.1.0-getFirehoseCustomers", summary: "Get Firehose Customers" },
      // User & Entitlements
      { operation_id: "OBPv4.0.0-getUsers", summary: "Get Users" },
      { operation_id: "OBPv4.0.0-getEntitlementsForBank", summary: "Get Entitlements for Bank" },
      // View Permissions
      { operation_id: "OBPv6.0.0-getViewPermissions", summary: "Get View Permissions" },
      { operation_id: "OBPv6.0.0-getCustomViews", summary: "Get Custom Views" },
      { operation_id: "OBPv6.0.0-getSystemViews", summary: "Get System Views" },
      { operation_id: "OBPv2.0.0-getPermissionsForBankAccount", summary: "Get Account Access Permissions" },
      // Transaction metadata audit
      { operation_id: "OBPv4.0.0-getTransactionsForBankAccount", summary: "Get Transactions for Account" },
      { operation_id: "OBPv1.2.1-getTagsForViewOnTransaction", summary: "Get Transaction Tags" },
      { operation_id: "OBPv1.2.1-getCommentsForViewOnTransaction", summary: "Get Transaction Comments" },
      // Firehose surveillance
      { operation_id: "OBPv4.0.0-getFirehoseAccountsAtOneBank", summary: "Get Firehose Accounts" },
      { operation_id: "OBPv3.0.0-getFirehoseTransactionsForBankAccount", summary: "Get Firehose Transactions" },
    ],
    products: [
      {
        id: "5.1",
        product_code: "regulator-ready-open-banking",
        name: "Regulator-Ready Open Banking",
        description:
          "Full consent audit (including VRP), deep KYC (checks, media, tax residence), CRM events, user-customer link audit and firehose surveillance for compliance teams.",
        capabilities: [
          "Consent lifecycle audit (AIS + VRP)",
          "KYC checks, media & tax residence",
          "User-customer link & CRM audit",
          "Firehose customer & transaction surveillance",
        ],
        monthly_subscription_amount: "250.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },

  // ── 6. Branch & ATM Network ──────────────────────────────────────────
  {
    id: "6",
    collection_name: "Branch-ATM-Network",
    description:
      "Branch and ATM management including location data, accessibility features, supported currencies, services and customer meetings.",
    functional_scope: [
      "Branch Management",
      "ATM Management",
      "Accessibility",
      "Customer Meetings",
      "Location Services",
    ],
    is_sharable: true,
    endpoints: [
      // Branches
      { operation_id: "OBPv3.0.0-getBranches", summary: "Get Branches for Bank" },
      { operation_id: "OBPv3.0.0-getBranch", summary: "Get Branch by Id" },
      { operation_id: "OBPv3.0.0-createBranch", summary: "Create Branch" },
      // ATMs
      { operation_id: "OBPv5.1.0-getAtms", summary: "Get Bank ATMs" },
      { operation_id: "OBPv5.1.0-getAtm", summary: "Get ATM by Id" },
      { operation_id: "OBPv5.1.0-createAtm", summary: "Create ATM" },
      { operation_id: "OBPv5.1.0-updateAtm", summary: "Update ATM" },
      { operation_id: "OBPv4.0.0-updateAtmAccessibilityFeatures", summary: "Update ATM Accessibility Features" },
      { operation_id: "OBPv4.0.0-updateAtmSupportedCurrencies", summary: "Update ATM Supported Currencies" },
      { operation_id: "OBPv4.0.0-updateAtmSupportedLanguages", summary: "Update ATM Supported Languages" },
      { operation_id: "OBPv4.0.0-updateAtmServices", summary: "Update ATM Services" },
      // ATM Attributes
      { operation_id: "OBPv5.1.0-createAtmAttribute", summary: "Create ATM Attribute" },
      { operation_id: "OBPv5.1.0-getAtmAttributes", summary: "Get ATM Attributes" },
      // Customer Meetings
      { operation_id: "OBPv3.1.0-createMeeting", summary: "Create Meeting (Video/Call)" },
      { operation_id: "OBPv3.1.0-getMeetings", summary: "Get Meetings" },
      { operation_id: "OBPv3.1.0-getMeeting", summary: "Get Meeting by Id" },
    ],
    products: [
      {
        id: "6.1",
        product_code: "branch-atm-locator",
        name: "Branch & ATM Locator",
        description:
          "Branch and ATM location data with accessibility features, supported currencies and services for customer-facing locator apps.",
        capabilities: [
          "Branch & ATM search by bank",
          "Accessibility feature metadata",
          "Supported currencies & languages",
          "Service availability information",
        ],
        monthly_subscription_amount: "25.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
      {
        id: "6.2",
        product_code: "network-management-suite",
        name: "Network Management Suite",
        description:
          "Full CRUD for branches, ATMs and their attributes — plus customer meeting scheduling for branch-based advisory services.",
        capabilities: [
          "Branch & ATM lifecycle management",
          "Custom ATM attribute creation",
          "Customer meeting scheduling",
          "ATM service & accessibility updates",
        ],
        monthly_subscription_amount: "175.00",
        monthly_subscription_currency: "EUR",
        per_second_call_limit: "1",
        per_minute_call_limit: "60",
        per_hour_call_limit: "3600",
        per_day_call_limit: "86400",
        per_week_call_limit: "604800",
        per_month_call_limit: "2592000",
      },
    ],
  },
];
