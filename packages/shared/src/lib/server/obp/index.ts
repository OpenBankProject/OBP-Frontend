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
export { grpcChannelCredentials } from './grpcCredentials.js';
export { DefaultOBPIntegrationService } from './OBPIntegrationService.js';
export type { OBPIntegrationService } from './OBPIntegrationService.js';
export { getOperationIds } from './operationIdsCache.js';
export type { OperationIdEntry } from './operationIdsCache.js';
export {
	getConsentsMaxTtlSeconds,
	capConsentTtlSeconds,
	_resetConsentsConfigCache
} from './consentsConfig.js';
export type { ObpGet } from './consentsConfig.js';
export { findReusableConsent, normalizeMyResources, myResourcesCovered } from './consentReuse.js';
export type { RequiredMyResources, RequiredPersonalDynamicEntity } from './consentReuse.js';
export { ensureSystemDynamicEntity, dynamicEntityDrift } from './dynamicEntityBootstrap.js';
export type { SystemDynamicEntityDefinition, DynamicEntityBootstrapDeps } from './dynamicEntityBootstrap.js';
export { createObpProxyHandler } from './obpProxy.js';
export type { ObpProxyRequestEvent } from './obpProxy.js';
export type {
	RequiredEntitlement,
	RequiredView,
	ReusableConsent
} from './consentReuse.js';
