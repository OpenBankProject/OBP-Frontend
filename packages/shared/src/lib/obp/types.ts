export interface OBPBank {
  bank_id: string;
  bank_code?: string;
  short_name?: string;
  full_name?: string;
  logo?: string;
  website?: string;
  bank_routings?: { scheme: string; address: string }[];
  attributes?: { name: string; value: string }[];
}

export interface OBPConsent {
    consent_reference_id: string;
    consent_id: string;
    consumer_id: string;
    created_by_user_id: string;
    status: string;
    created_date?: string;
    last_action_date: string;
    last_usage_date: string;
    everything?: boolean;
    jwt: string;
    jwt_payload: {
        createdByUserId: string;
        sub: string;
        iss: string;
        aud: string;
        jti: string;
        iat: number;
        nbf: number;
        exp: number;
        request_headers: any[];
        entitlements: any[];
        views: any[];
    };
    api_standard: string;
    api_version: string;
}

export interface OBPConsentInfo {
    consent_id: string;
    consumer_id: string;
    created_by_user_id: string;
    last_action_date: string;
    last_usage_date: string;
    status: string;
    api_standard: string;
    api_version: string;
}

export interface OBPConsumer {
    consumer_id: string;
    key?: string;
    secret?: string;
    app_name: string;
    app_type: 'public' | 'confidential';
    description: string;
    developer_email: string;
    redirect_url: string;
    company: string;
    created_by_user_id: string;
    created_by_user: {
        user_id: string;
        email: string;
        provider_id: string;
        provider: string;
        username: string;
    };
    enabled: boolean;
    created: string;
}

export interface OBPConsumerRequestBody {
    app_type: 'public' | 'confidential',
    app_name: string,
    redirect_url: string,
    developer_email: string,
    description: string,
    company: string
    enabled: boolean
}

export interface OBPUserRegistrationRequestBody {
    email: string;
    username: string;
    password: string;
    first_name: string;
    last_name: string;
}

export interface OBPAddEntitlementBody {
    role_name: string;
    bank_id?: string;
}

export interface OBPPasswordResetInitiateRequestBody {
    username: string;
    email: string;
}

export interface OBPPasswordResetRequestBody {
    token: string;
    new_password: string;
}

export interface OBPUserInvitation {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    country: string;
    purpose: 'DEVELOPER' | 'CUSTOMER';
    status: 'CREATED' | 'FINISHED';
}

export interface OBPUserInvitationValidateRequestBody {
    secret_key: number;
}

export interface OBPUserInvitationCreateRequestBody {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    country: string;
    purpose: 'DEVELOPER' | 'CUSTOMER';
}

export interface OBPUserInvitationsResponse {
    user_invitations: OBPUserInvitation[];
}

export interface OBPUserInvitationAcceptRequestBody {
    secret_key: number;
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    country: string;
}

// API Collection types
export interface OBPApiCollection {
    api_collection_id: string;
    api_collection_name: string;
    description: string;
    is_sharable: boolean;
    user_id: string;
}

export interface OBPApiCollectionsResponse {
    api_collections: OBPApiCollection[];
}

export interface OBPApiCollectionEndpoint {
    api_collection_endpoint_id: string;
    api_collection_id: string;
    operation_id: string;
}

export interface OBPApiCollectionEndpointsResponse {
    api_collection_endpoints: OBPApiCollectionEndpoint[];
}

// Product types (API Tiers)
export interface OBPProductAttribute {
    name: string;
    type: 'STRING' | 'INTEGER' | 'DOUBLE' | 'DATE_WITH_DAY';
    value: string;
    is_active?: boolean;
}

export interface OBPProduct {
    bank_id: string;
    product_code: string;
    parent_product_code?: string;
    name: string;
    more_info_url?: string;
    terms_and_conditions_url?: string;
    description?: string;
    meta?: {
        license: {
            id: string;
            name: string;
        };
    };
    product_attributes?: OBPProductAttribute[];
}

export interface OBPProductsResponse {
    products: OBPProduct[];
}

// Product Collection (grouping of products)
export interface OBPProductCollection {
    collection_code: string;
    products: OBPProduct[];
}

// API Product details (uses first-class fields from the API Product response)
export interface APIProductDetails {
    product: OBPProduct;
    apiCollectionId?: string;
    stripePriceId?: string;
    category?: string;
    rateLimitPerSecond?: number;
    rateLimitPerMinute?: number;
    rateLimitPerHour?: number;
    rateLimitPerDay?: number;
    rateLimitPerWeek?: number;
    rateLimitPerMonth?: number;
    features?: string[];
    priceMonthly?: number;
    priceCurrency?: string;
    endpointCount?: number;
}

// Account Application (Order)
export interface OBPAccountApplication {
    account_application_id: string;
    product_code: string;
    user: {
        user_id: string;
        email: string;
        provider_id: string;
        provider: string;
        username: string;
    };
    customer?: {
        customer_id: string;
        customer_number: string;
        legal_name: string;
        mobile_phone_number: string;
        email: string;
        face_image: {
            url: string;
            date: string;
        };
        date_of_birth: string;
        relationship_status: string;
        dependants: number;
        dob_of_dependants: string[];
        highest_education_attained: string;
        employment_status: string;
        kyc_status: boolean;
        last_ok_date: string;
    };
    date_of_application: string;
    status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'ACTIVE' | 'CANCELLED';
}

export interface OBPAccountApplicationsResponse {
    account_applications: OBPAccountApplication[];
}

export interface OBPAccountApplicationCreateBody {
    product_code: string;
}