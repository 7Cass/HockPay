import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?:
    | HttpParams
    | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
}

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly http = inject(HttpClient);
  public readonly baseUrl = environment.apiBaseUrl;

  /**
   * Performs an HTTP GET request.
   */
  get<T>(endpoint: string, options?: HttpOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, options);
  }

  /**
   * Performs an HTTP POST request.
   */
  post<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, options);
  }

  /**
   * Performs an HTTP PUT request.
   */
  put<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, options);
  }

  /**
   * Performs an HTTP PATCH request.
   */
  patch<T>(endpoint: string, body: any, options?: HttpOptions): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body, options);
  }

  /**
   * Performs an HTTP DELETE request.
   */
  delete<T>(endpoint: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, options);
  }
}
