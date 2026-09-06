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
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

class ConsoleLogger implements Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, ...args: any[]): void {
    try {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
      
      switch (level) {
        case 'debug':
          console.debug(prefix, ...args);
          break;
        case 'info':
          console.log(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'error':
          console.error(prefix, ...args);
          break;
      }
    } catch (e) {
      // Fallback if our logging fails
      console.error(`Logger failed:`, e, ...args);
    }
  }

  debug = (...args: any[]): void => {
    this.log('debug', ...args);
  }

  info = (...args: any[]): void => {
    this.log('info', ...args);
  }

  warn = (...args: any[]): void => {
    this.log('warn', ...args);
  }

  error = (...args: any[]): void => {
    this.log('error', ...args);
  }
}

export function createLogger(context: string): Logger {
  return new ConsoleLogger(context);
}