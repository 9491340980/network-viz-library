import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { NetworkError } from '../interfaces/network-visualization.interfaces';

@Injectable({
  providedIn: 'root'
})
export class NetworkErrorService {
  private errorSubject = new Subject<NetworkError>();
  public errors$ = this.errorSubject.asObservable();

  /**
   * Handles and broadcasts network visualization errors
   */
  handleError(error: NetworkError): void {
    console.error(`Network Visualization Error [${error.type}]:`, error.message, error.originalError);
    this.errorSubject.next(error);
  }

  /**
   * Creates a standardized error object
   */
  createError(type: NetworkError['type'], message: string, originalError?: Error, context?: any): NetworkError {
    return {
      type,
      message,
      originalError,
      context
    };
  }

  /**
   * Creates a data validation error
   */
  createDataError(message: string, originalError?: Error): NetworkError {
    return this.createError('data', message, originalError);
  }

  /**
   * Creates a rendering error
   */
  createRenderingError(message: string, originalError?: Error): NetworkError {
    return this.createError('rendering', message, originalError);
  }

  /**
   * Creates an interaction error
   */
  createInteractionError(message: string, originalError?: Error): NetworkError {
    return this.createError('interaction', message, originalError);
  }

  /**
   * Creates a configuration error
   */
  createConfigurationError(message: string, originalError?: Error): NetworkError {
    return this.createError('configuration', message, originalError);
  }
}
