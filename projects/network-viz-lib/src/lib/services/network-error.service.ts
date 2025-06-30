import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NetworkError } from '../interfaces/network-visualization.interfaces';

export interface ErrorLog {
  id: string;
  error: NetworkError;
  timestamp: Date;
  resolved: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkErrorService {
  private errors$ = new BehaviorSubject<NetworkError | null>(null);
  private errorLog: ErrorLog[] = [];
  private errorCount = 0;

  /**
   * Current error observable
   */
  get currentError$(): Observable<NetworkError | null> {
    return this.errors$.asObservable();
  }

  /**
   * Get current error
   */
  get currentError(): NetworkError | null {
    return this.errors$.value;
  }

  /**
   * Get error history
   */
  get errorHistory(): ErrorLog[] {
    return [...this.errorLog];
  }

  /**
   * Create a standardized network error
   */
  createError(
    type: 'data' | 'rendering' | 'interaction' | 'configuration',
    message: string,
    originalError?: Error | any,
    context?: any
  ): NetworkError {
    return {
      type,
      message: this.sanitizeErrorMessage(message),
      originalError: originalError instanceof Error ? originalError : undefined,
      context: context ? this.sanitizeContext(context) : undefined
    };
  }

  /**
   * Handle and log an error
   */
  handleError(error: NetworkError): void {
    // Log to console in development
    if (this.isDevelopment()) {
      console.group(`🔴 Network Visualization Error (${error.type})`);
      console.error('Message:', error.message);
      if (error.originalError) {
        console.error('Original Error:', error.originalError);
      }
      if (error.context) {
        console.error('Context:', error.context);
      }
      console.groupEnd();
    }

    // Add to error log
    this.logError(error);

    // Set as current error
    this.errors$.next(error);

    // Auto-clear error after timeout for non-critical errors
    if (this.isRecoverableError(error)) {
      setTimeout(() => {
        if (this.currentError === error) {
          this.clearError();
        }
      }, 10000); // 10 seconds
    }
  }

  /**
   * Clear current error
   */
  clearError(): void {
    const currentError = this.currentError;
    if (currentError) {
      this.markErrorAsResolved(currentError);
    }
    this.errors$.next(null);
  }

  /**
   * Handle data validation errors
   */
  handleDataError(message: string, data?: any): NetworkError {
    const error = this.createError('data', message, undefined, { data });
    this.handleError(error);
    return error;
  }

  /**
   * Handle rendering errors
   */
  handleRenderingError(message: string, originalError?: Error, context?: any): NetworkError {
    const error = this.createError('rendering', message, originalError, context);
    this.handleError(error);
    return error;
  }

  /**
   * Handle interaction errors
   */
  handleInteractionError(message: string, event?: Event, context?: any): NetworkError {
    const error = this.createError('interaction', message, undefined, { event, ...context });
    this.handleError(error);
    return error;
  }

  /**
   * Handle configuration errors
   */
  handleConfigurationError(message: string, config?: any): NetworkError {
    const error = this.createError('configuration', message, undefined, { config });
    this.handleError(error);
    return error;
  }

  /**
   * Check if there are any unresolved errors
   */
  hasUnresolvedErrors(): boolean {
    return this.errorLog.some(log => !log.resolved);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: NetworkError['type']): ErrorLog[] {
    return this.errorLog.filter(log => log.error.type === type);
  }

  /**
   * Get recent errors (last 24 hours)
   */
  getRecentErrors(): ErrorLog[] {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.errorLog.filter(log => log.timestamp > twentyFourHoursAgo);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Export error log for debugging
   */
  exportErrorLog(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      totalErrors: this.errorLog.length,
      unresolvedErrors: this.errorLog.filter(log => !log.resolved).length,
      errors: this.errorLog.map(log => ({
        id: log.id,
        type: log.error.type,
        message: log.error.message,
        timestamp: log.timestamp.toISOString(),
        resolved: log.resolved,
        hasOriginalError: !!log.error.originalError,
        hasContext: !!log.error.context
      }))
    }, null, 2);
  }

  /**
   * Create error from unknown error object
   */
  createFromUnknown(unknownError: any, context?: any): NetworkError {
    let message = 'Unknown error occurred';
    let originalError: Error | undefined;

    if (unknownError instanceof Error) {
      message = unknownError.message;
      originalError = unknownError;
    } else if (typeof unknownError === 'string') {
      message = unknownError;
    } else if (unknownError && typeof unknownError === 'object') {
      message = unknownError.message || unknownError.toString() || message;
    }

    return this.createError('rendering', message, originalError, context);
  }

  /**
   * Wrap async operations with error handling
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    errorType: NetworkError['type'] = 'rendering',
    context?: any
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const networkError = this.createError(
        errorType,
        error instanceof Error ? error.message : 'Async operation failed',
        error instanceof Error ? error : undefined,
        context
      );
      this.handleError(networkError);
      throw networkError;
    }
  }

  /**
   * Wrap sync operations with error handling
   */
  wrapSync<T>(
    operation: () => T,
    errorType: NetworkError['type'] = 'rendering',
    context?: any
  ): T {
    try {
      return operation();
    } catch (error) {
      const networkError = this.createError(
        errorType,
        error instanceof Error ? error.message : 'Sync operation failed',
        error instanceof Error ? error : undefined,
        context
      );
      this.handleError(networkError);
      throw networkError;
    }
  }

  private logError(error: NetworkError): void {
    const errorLog: ErrorLog = {
      id: this.generateErrorId(),
      error,
      timestamp: new Date(),
      resolved: false
    };

    this.errorLog.unshift(errorLog);

    // Keep only last 100 errors to prevent memory leaks
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(0, 100);
    }
  }

  private markErrorAsResolved(error: NetworkError): void {
    const errorLog = this.errorLog.find(log => log.error === error);
    if (errorLog) {
      errorLog.resolved = true;
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${++this.errorCount}`;
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove sensitive information and ensure message is user-friendly
    return message
      .replace(/\b\d{4,}\b/g, '[ID]') // Replace long numbers that might be IDs
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Replace emails
      .substring(0, 500); // Limit length
  }

  private sanitizeContext(context: any): any {
    try {
      // Create a clean copy without circular references
      return JSON.parse(JSON.stringify(context, (key, value) => {
        // Remove potential sensitive data
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
          return '[REDACTED]';
        }
        return value;
      }));
    } catch {
      return { error: 'Context could not be serialized' };
    }
  }

  private isRecoverableError(error: NetworkError): boolean {
    // Determine if error can be auto-cleared
    const recoverableTypes = ['interaction'];
    const recoverableMessages = [
      'hover',
      'click',
      'temporary',
      'network request'
    ];

    return recoverableTypes.includes(error.type) ||
           recoverableMessages.some(msg =>
             error.message.toLowerCase().includes(msg)
           );
  }

  private isDevelopment(): boolean {
    // Check if we're in development mode
    // return !environment?.production ?? true;
    return true
  }
}

// Environment detection (fallback)
declare const environment: { production: boolean } | undefined;
