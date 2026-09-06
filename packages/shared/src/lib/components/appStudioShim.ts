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
/**
 * App Studio: the bridge between a generated app running in a sandboxed iframe
 * and the host page that proxies its OBP calls.
 *
 * The iframe is `sandbox="allow-scripts"` WITHOUT `allow-same-origin`, so the
 * generated code has no cookies, no storage and no access to the host DOM. The
 * only way out is postMessage. The shim below is injected into the app's HTML
 * and exposes `window.obp` (get/post/put/delete/request); the host answers each
 * call by forwarding it to its own `/proxy/obp/...` route, so the app's reach
 * is whatever the host chooses to allow, never the user's session directly.
 *
 * Messages (iframe -> host):
 *   { type: 'obp-studio:request', id, method, path, body? }
 *   { type: 'obp-studio:log', level: 'log'|'warn'|'error', message }
 *   { type: 'obp-studio:ready' }
 *   { type: 'obp-studio:resize', height }        content height, so the host can size the frame
 *   { type: 'obp-studio:navigate', url }         the app asks the host page to navigate
 *   { type: 'obp-studio:emit', name, data }      an application-level message (e.g. a report's result)
 * Messages (host -> iframe):
 *   { type: 'obp-studio:response', id, ok, status, body?, error? }
 */

export const APP_STUDIO_MESSAGE_PREFIX = 'obp-studio:';

export interface AppStudioRequestMessage {
	type: 'obp-studio:request';
	id: string;
	method: string;
	path: string;
	body?: unknown;
}

export interface AppStudioLogMessage {
	type: 'obp-studio:log';
	level: 'log' | 'warn' | 'error';
	message: string;
}

export interface AppStudioResizeMessage {
	type: 'obp-studio:resize';
	height: number;
}

export interface AppStudioNavigateMessage {
	type: 'obp-studio:navigate';
	url: string;
}

export interface AppStudioEmitMessage {
	type: 'obp-studio:emit';
	name: string;
	data?: unknown;
}

export interface AppStudioResponseMessage {
	type: 'obp-studio:response';
	id: string;
	ok: boolean;
	status: number;
	body?: unknown;
	error?: string;
}

/** The result the host returns for one proxied OBP call. */
export interface AppStudioProxyResult {
	ok: boolean;
	status: number;
	body?: unknown;
	error?: string;
}

/** Plain JavaScript (no TS, no imports): runs inside the sandboxed iframe before the app's own code. */
export const APP_STUDIO_SHIM_SOURCE = `(function () {
  var pending = {};
  var seq = 0;
  function post(msg) { window.parent.postMessage(msg, '*'); }
  function request(method, path, body) {
    return new Promise(function (resolve, reject) {
      var id = 'r' + (++seq) + '-' + Date.now();
      pending[id] = { resolve: resolve, reject: reject };
      post({ type: 'obp-studio:request', id: id, method: String(method || 'GET').toUpperCase(), path: String(path || ''), body: body });
    });
  }
  function unwrap(p) {
    return p.then(function (r) {
      if (r.ok) return r.body;
      var err = new Error(r.error || ('HTTP ' + r.status));
      err.status = r.status;
      err.body = r.body;
      throw err;
    });
  }
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || m.type !== 'obp-studio:response') return;
    var p = pending[m.id];
    if (!p) return;
    delete pending[m.id];
    p.resolve({ ok: !!m.ok, status: m.status, body: m.body, error: m.error });
  });
  window.obp = {
    request: request,
    get: function (path) { return unwrap(request('GET', path)); },
    post: function (path, body) { return unwrap(request('POST', path, body)); },
    put: function (path, body) { return unwrap(request('PUT', path, body)); },
    delete: function (path) { return unwrap(request('DELETE', path)); },
    navigate: function (url) { post({ type: 'obp-studio:navigate', url: String(url || '') }); },
    emit: function (name, data) { post({ type: 'obp-studio:emit', name: String(name || ''), data: data }); }
  };
  // Report content height so a host that shows the app at page size can fit the frame to it.
  var lastHeight = 0;
  function reportHeight() {
    var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (h && h !== lastHeight) { lastHeight = h; post({ type: 'obp-studio:resize', height: h }); }
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(reportHeight).observe(document.documentElement);
  }
  window.addEventListener('load', reportHeight);
  setInterval(reportHeight, 1000);
  function fmt(args) {
    return Array.prototype.map.call(args, function (a) {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
  }
  ['log', 'warn', 'error'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      post({ type: 'obp-studio:log', level: level, message: fmt(arguments) });
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    post({ type: 'obp-studio:log', level: 'error', message: (e.message || 'Script error') + (e.lineno ? ' (line ' + e.lineno + ')' : '') });
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    post({ type: 'obp-studio:log', level: 'error', message: 'Unhandled promise rejection: ' + (r && r.message ? r.message : String(r)) });
  });
  post({ type: 'obp-studio:ready' });
})();`;

/**
 * Inject the shim into an HTML document so it runs before any app script.
 * Works with a full document, a fragment, or an empty string.
 */
export function buildAppStudioSrcdoc(source: string): string {
	const shimTag = `<script>${APP_STUDIO_SHIM_SOURCE}</script>`;
	const html = source ?? '';
	const headMatch = html.match(/<head[^>]*>/i);
	if (headMatch && headMatch.index !== undefined) {
		const at = headMatch.index + headMatch[0].length;
		return html.slice(0, at) + shimTag + html.slice(at);
	}
	const htmlMatch = html.match(/<html[^>]*>/i);
	if (htmlMatch && htmlMatch.index !== undefined) {
		const at = htmlMatch.index + htmlMatch[0].length;
		return html.slice(0, at) + `<head>${shimTag}</head>` + html.slice(at);
	}
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${shimTag}</head><body>${html}</body></html>`;
}

/**
 * Turn an app path like `/obp/v6.0.0/banks?limit=5` into the host proxy path
 * `/proxy/obp/v6.0.0/banks?limit=5`. Returns null when the path is not an OBP path.
 */
export function appStudioPathToProxyPath(path: string, proxyBase = '/proxy/obp'): string | null {
	const trimmed = (path ?? '').trim();
	if (!trimmed.startsWith('/obp/')) return null;
	if (trimmed.includes('..') || trimmed.includes('://') || trimmed.includes('\0')) return null;
	return `${proxyBase}/${trimmed.slice('/obp/'.length)}`;
}
