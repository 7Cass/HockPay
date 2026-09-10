import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { OperatorAuthService } from '../../admin/services/operator-auth.service';
import { authInterceptor } from './auth.interceptor';

const API = 'http://localhost:3000/api/v1';

/**
 * The two sessions live in the same browser. What keeps them apart on the wire
 * is that a 401 is renewed by the session that owns the route -- and by that
 * one only.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let merchant: AuthService;
  let operator: OperatorAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    merchant = TestBed.inject(AuthService);
    operator = TestBed.inject(OperatorAuthService);

    merchant.isAuthenticated.set(true);
    operator.isAuthenticated.set(true);
  });

  afterEach(() => httpMock.verify());

  it('sends the cookies on every request', () => {
    http.get(`${API}/payments`).subscribe();

    expect(httpMock.expectOne(`${API}/payments`).request.withCredentials).toBe(true);
    httpMock.expectNone(`${API}/payments`);
  });

  it('renews the merchant session on a merchant 401, and replays the request', async () => {
    const done = new Promise<unknown>((resolve) => http.get(`${API}/payments`).subscribe(resolve));

    httpMock.expectOne(`${API}/payments`).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${API}/auth/refresh`).flush({ expiresIn: 900 });
    httpMock.expectOne(`${API}/payments`).flush({ payments: [] });

    await expect(done).resolves.toEqual({ payments: [] });
    expect(operator.isAuthenticated()).toBe(true);
  });

  it('renews the desk session on an operator 401, never the merchant one', async () => {
    const done = new Promise<unknown>((resolve) =>
      http.get(`${API}/operator/stores`).subscribe(resolve),
    );

    httpMock
      .expectOne(`${API}/operator/stores`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${API}/auth/refresh`);
    httpMock.expectOne(`${API}/operator/auth/refresh`).flush({ expiresIn: 900 });
    httpMock.expectOne(`${API}/operator/stores`).flush({ data: [] });

    await expect(done).resolves.toEqual({ data: [] });
  });

  it('an expired desk session does not log the merchant out', async () => {
    const failed = new Promise<HttpErrorResponse>((resolve) =>
      http.get(`${API}/operator/stores`).subscribe({ error: resolve }),
    );

    httpMock
      .expectOne(`${API}/operator/stores`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${API}/operator/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await failed;

    expect(operator.isAuthenticated()).toBe(false);
    expect(merchant.isAuthenticated()).toBe(true);
  });

  it('an expired merchant session does not close the desk', async () => {
    const failed = new Promise<HttpErrorResponse>((resolve) =>
      http.get(`${API}/payments`).subscribe({ error: resolve }),
    );

    httpMock.expectOne(`${API}/payments`).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await failed;

    expect(merchant.isAuthenticated()).toBe(false);
    expect(operator.isAuthenticated()).toBe(true);
  });

  it('does not try to renew a login or a refresh that itself came back 401', async () => {
    const failed = new Promise<HttpErrorResponse>((resolve) =>
      http.post(`${API}/operator/auth/login`, {}).subscribe({ error: resolve }),
    );

    httpMock
      .expectOne(`${API}/operator/auth/login`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect((await failed).status).toBe(401);
    httpMock.expectNone(`${API}/operator/auth/refresh`);
  });

  it('reads "operator" as a path segment, not as a substring of an id', async () => {
    const failed = new Promise<HttpErrorResponse>((resolve) =>
      http.get(`${API}/payments/operator-report-42`).subscribe({ error: resolve }),
    );

    httpMock
      .expectOne(`${API}/payments/operator-report-42`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${API}/operator/auth/refresh`);
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await failed;
  });
});
