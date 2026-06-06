// apps/api/src/lib/api-error-handler.ts
//
// Centralized API error observability for the pas-api Express server.
//
// 2026-06-05: Created during the Sentry full-coverage rollout. Before this
// shipped, ~91% of catch blocks in src/index.ts called only `console.error`
// before returning a 500 — those errors never reached Sentry. The
// `errors-outages` view showed 2 events in 30 days for what should have been
// a noisy production API. This module fixes that.
//
// EXPORTS:
//   - handleApiError(res, err, ctx) — the helper every catch block should use.
//   - requestIdMiddleware           — assigns a UUID per request, tags Sentry.
//   - sentryUserContextMiddleware   — decodes the Bearer JWT and attaches the
//                                     user id to the Sentry scope.
//   - fivexxInterceptorMiddleware   — defense-in-depth: any 5xx response NOT
//                                     produced via handleApiError is captured
//                                     as a Sentry message (fallback signal).
//
// USAGE in src/index.ts:
//   import { handleApiError, requestIdMiddleware,
//            sentryUserContextMiddleware, fivexxInterceptorMiddleware }
//     from './lib/api-error-handler';
//
//   app.use(requestIdMiddleware);
//   app.use(sentryUserContextMiddleware);
//   app.use(fivexxInterceptorMiddleware);
//   // ... all routes ...
//
//   app.post('/foo', async (req, res) => {
//       try { ... }
//       catch (err) {
//           return handleApiError(res, err, {
//               area: 'foo.create',
//               extra: { userId: user?.id },
//           });
//       }
//   });

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface ErrorContext {
    /** Sentry area tag, e.g. 'auth.signup', 'orders.create', 'ws2.cancel'. Used to filter the Sentry inbox. */
    area: string;
    /** Optional structured context — orderId, userId, phone, paymentId, etc. Becomes the Sentry `extra` payload. */
    extra?: Record<string, any>;
    /** Override the user-facing error message (default: 'Internal server error'). */
    userMessage?: string;
    /** HTTP status code (default: 500). */
    statusCode?: number;
    /** Include error.message in response body (NON-PROD only). Default: false. */
    includeDetails?: boolean;
}

/**
 * Centralized API error handler. Logs to console, reports to Sentry with
 * full stack trace + structured context, then returns a 500 JSON response.
 *
 * IMPORTANT: always `return handleApiError(...)` from the catch block so
 * Express doesn't double-send the response.
 */
export function handleApiError(
    res: Response,
    err: unknown,
    ctx: ErrorContext,
): Response {
    const error = err instanceof Error ? err : new Error(String(err));
    const statusCode = ctx.statusCode ?? 500;
    const userMessage = ctx.userMessage ?? 'Internal server error';

    // Cloud-log for grep + correlation with X-Request-Id header.
    const reqId = (res.req as any)?.id ?? '?';
    console.error(`[${ctx.area}] req=${reqId} error=`, error.message);
    if (error.stack) {
        // First non-internal frame, useful in tail logs without flooding.
        const firstFrame = error.stack.split('\n').slice(1, 4).join('\n');
        console.error(firstFrame);
    }

    // Capture to Sentry with full Error object (preserves stack + type for
    // proper grouping + source-map application).
    try {
        Sentry.captureException(error, {
            tags: {
                area: ctx.area,
                http_status: String(statusCode),
            },
            extra: {
                requestId: reqId,
                statusCode,
                ...ctx.extra,
            },
        });
    } catch {
        // Sentry SDK failure must NOT take down the request — log and proceed.
        console.error(`[${ctx.area}] Sentry.captureException itself threw — Sentry SDK problem?`);
    }

    // Mark before sending so the 5xx interceptor doesn't double-capture.
    markResponseAsReported(res);

    // User-facing response.
    const body: Record<string, any> = { error: userMessage };
    if (ctx.includeDetails && process.env.NODE_ENV !== 'production') {
        body.details = error.message;
    }
    return res.status(statusCode).json(body);
}

/**
 * Express middleware — assigns a UUID per request, exposes it via req.id and
 * the X-Request-Id response header, and tags the active Sentry scope so the
 * id appears on every captured event from this request.
 *
 * Mount this FIRST, before any other middleware.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incoming = (req.headers['x-request-id'] as string) || randomUUID();
    (req as any).id = incoming;
    res.setHeader('X-Request-Id', incoming);
    try {
        Sentry.setTag('request_id', incoming);
    } catch {
        // Sentry not initialised → no-op.
    }
    next();
}

/**
 * Express middleware — decodes the Bearer JWT (without verifying) so the
 * user id appears on every Sentry event from this request. Does NOT gate or
 * authenticate; the per-endpoint requireUser/requireAdmin still own that.
 *
 * Mount AFTER requestIdMiddleware, BEFORE routes.
 */
export function sentryUserContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                const userId = payload?.sub;
                if (userId) {
                    Sentry.setUser({
                        id: userId,
                        ip_address: req.ip,
                        // Phone is useful for support correlation but only present in our JWT shape.
                        ...(payload.phone ? { username: String(payload.phone) } : {}),
                    });
                }
            }
        }
    } catch {
        // Bad/expired token, malformed payload — best-effort enrichment only.
    }
    next();
}

/**
 * Express middleware — defense-in-depth fallback for any 5xx response that
 * was NOT produced via handleApiError. Wraps res.json to inspect the status
 * code and emit a Sentry message if it's 5xx.
 *
 * Won't double-report errors already captured by handleApiError (the handler
 * sets a marker symbol on the response); it ONLY fires for code paths that
 * still use the legacy `res.status(500).json(...)` pattern.
 *
 * Mount LAST in the middleware chain, BEFORE routes.
 */
const ALREADY_REPORTED = Symbol('sentryAlreadyReported');

export function fivexxInterceptorMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Helper to capture; called from both .json and .send wrappers.
    //
    // IMPORTANT: We use `captureException` with a synthetic Error rather than
    // `captureMessage`. Sentry categorizes `captureMessage` events as
    // 'default' category which falls OUTSIDE the "Errors & Outages" view —
    // they'd appear in "All Views" but not in the most-visited error inbox.
    // captureException keeps them in the 'error' category where they belong.
    const capture = (body: any): void => {
        if (res.statusCode < 500 || (res as any)[ALREADY_REPORTED]) return;
        try {
            const reqId = (req as any).id ?? '?';
            const synth = new Error(
                `Unhandled 5xx response: ${req.method} ${req.path} → ${res.statusCode}`
            );
            // Mark as a synthetic error so grouping is by route + status, not stack.
            synth.name = `Unhandled5xx_${req.method}_${res.statusCode}`;
            Sentry.captureException(synth, {
                tags: {
                    area: 'global.5xx-fallback',
                    method: req.method,
                    path: req.path,
                    http_status: String(res.statusCode),
                },
                extra: {
                    requestId: reqId,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    body: (() => {
                        try {
                            return typeof body === 'string' ? body.slice(0, 2000) : JSON.stringify(body).slice(0, 2000);
                        } catch { return '<unserializable>'; }
                    })(),
                },
            });
        } catch {
            // Sentry SDK problem — don't break the response.
        }
    };

    const originalJson = res.json.bind(res);
    res.json = function (body: any): Response {
        capture(body);
        return originalJson(body);
    } as typeof res.json;

    const originalSend = res.send.bind(res);
    res.send = function (body: any): Response {
        capture(body);
        return originalSend(body);
    } as typeof res.send;

    next();
}

/**
 * Mark a response as already reported to Sentry. Called by handleApiError so
 * the 5xx interceptor doesn't double-fire.
 */
export function markResponseAsReported(res: Response): void {
    (res as any)[ALREADY_REPORTED] = true;
}
