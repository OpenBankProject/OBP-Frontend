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
export {
	fetchApiVersions,
	latestVersionFor,
	findVersion,
	findByFullyQualified,
	groupByStandard,
	clearApiVersionsCache,
	DEFAULT_META_VERSION
} from './apiVersions.js';
export type { ObpGetter, ApiVersionOptions } from './apiVersions.js';

export {
	fetchResourceDocs,
	getResourceDocIndex,
	preWarmResourceDocs,
	getCacheStatus,
	clearResourceDocsCache
} from './resourceDocsCache.js';
export type { ResourceDocsOptions } from './resourceDocsCache.js';

export {
	API_GLOSSARY_PATH,
	fetchApiGlossary,
	loadGlossaryIndex,
	loadGlossaryEntry,
	searchGlossary,
	glossaryAnchorResolver,
	excerptFromMarkdown,
	rewriteInGlossaryLinks,
	clearGlossaryCache
} from './glossaryCache.js';
export type {
	ApiGlossaryItem,
	GlossaryCacheState,
	GlossaryIndexRow,
	GlossaryEntryView,
	GlossaryOptions,
	GlossaryLinkTargets
} from './glossaryCache.js';

export {
	MESSAGE_DOC_CONNECTORS,
	DEFAULT_CONNECTOR,
	isKnownConnector,
	connectorLabel,
	loadMessageDocIndex,
	loadMessageDoc,
	clearMessageDocsCache
} from './messageDocsCache.js';
export type { MessageDoc, MessageDocIndexRow, MessageDocsOptions } from './messageDocsCache.js';

export { listGrpcServices, shortTypeName, methodSignature } from './grpcReflection.js';
export type { GrpcServiceInfo, GrpcMethodInfo, GrpcFieldInfo } from './grpcReflection.js';
