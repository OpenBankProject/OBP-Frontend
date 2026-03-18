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