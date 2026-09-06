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
// User and Authentication Types
export interface User {
  user_id: string;
  email: string;
  username?: string;
  full_name?: string;
  created_at?: string;
  last_login?: string;
}

export interface AuthInfo {
  authenticated: boolean;
}

export interface OAuthData {
  access_token: string;
  refresh_token?: string;
  provider: string;
  expires_at?: number;
  token_type?: string;
}

// Session Types
export interface SessionData {
  user?: User;
  oauth?: OAuthData;
  authInfo?: AuthInfo;
}

// Navigation Types
export interface NavigationItem {
  href: string;
  label: string;
  icon: string;
  available: boolean;
  requiresAuth?: boolean;
}

// OAuth Provider Types
export interface WellKnownUri {
  provider: string;
  url: string;
}

export interface OAuth2Client {
  authorizeURL: (options: OAuth2AuthorizeOptions) => URL;
  validateAuthorizationCode: (
    code: string,
    codeVerifier?: string,
  ) => Promise<OAuth2Token>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Token>;
  checkAccessTokenExpiration: (token: string) => Promise<boolean>;
}

export interface OAuth2AuthorizeOptions {
  state?: string;
  scopes?: string[];
  codeVerifier?: string;
  redirectUri?: string;
}

export interface OAuth2Token {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  message?: string;
}

// Notification Types
export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  dismissible?: boolean;
  autoClose?: boolean;
  duration?: number;
  timestamp: Date;
}

// Component Props Types
export interface AuthStatusProps {
  user: User | null;
  authInfo: AuthInfo | null;
}

export interface NavigationProps {
  user: User | null;
  authInfo: AuthInfo | null;
}

export interface AuthNotificationProps {
  type: NotificationType;
  title: string;
  message: string;
  dismissible?: boolean;
  autoClose?: boolean;
  duration?: number;
}

// Page Data Types
export interface LayoutData {
  user: User | null;
  authInfo: AuthInfo | null;
}

export interface PageData extends LayoutData {
  [key: string]: any;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Feature Types
export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: "available" | "limited" | "unavailable";
  requiresAuth?: boolean;
  requiresFullAccess?: boolean;
  path?: string;
}

// Configuration Types
export interface AppConfig {
  oauth: {
    clientId: string;
    redirectUri: string;
    scope: string[];
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "select" | "textarea" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => string | null;
  };
}

export interface FormData {
  [key: string]: string | number | boolean | string[];
}

export interface FormErrors {
  [key: string]: string;
}

// API Management Types (for future features)
export interface ApiEndpoint {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description?: string;
  parameters?: ApiParameter[];
  responses?: ApiResponse[];
  tags?: string[];
}

export interface ApiParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description?: string;
  example?: any;
}

// Metrics Types (for future features)
export interface Metric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  data: { timestamp: Date; value: number }[];
  unit?: string;
}

// Component Event Types
export interface ComponentEvent<T = any> {
  type: string;
  data?: T;
  target?: EventTarget;
  timestamp: Date;
}

// Store Types (for future Svelte stores)
export interface AppStore {
  user: User | null;
  authInfo: AuthInfo | null;
  notifications: Notification[];
  loading: boolean;
  error: AppError | null;
}

// Route Types
export interface RouteInfo {
  id: string;
  path: string;
  title: string;
  requiresAuth: boolean;
  component: string;
}
