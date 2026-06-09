// instrument.ts — Sentry initialization for the pas-api Express server.
//
// MUST be the very first import after `dotenv.config()` in src/index.ts so that
// Sentry instruments node-fetch, http, express, postgres, etc. before any of
// those modules are loaded. Per Sentry's Express SDK guidance:
//   https://docs.sentry.io/platforms/javascript/guides/express/install/
//
// DSN resolution:
//   - Reads SENTRY_DSN from environment (set on Elastic Beanstalk for prod).
//   - If missing → init() is skipped silently. The SDK becomes a no-op so
//     code in src/index.ts that calls Sentry.captureException(...) still works
//     and doesn't throw.
//
// Environment tagging:
//   - `environment` tag distinguishes prod vs local. EB sets NODE_ENV=production.
//   - `release` left undefined here; source-map upload via @sentry/wizard sets
//     this automatically per deploy when we wire that step.

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        // PII collection: matches the Sentry-suggested default for Express;
        // captures user IP for geo + spam-bot triage. Our API receives JWT
        // identity in the auth header, NOT in request bodies, so this does
        // not leak customer/merchant identity into Sentry payloads.
        sendDefaultPii: true,

        // Environment tag derived from NODE_ENV. EB sets this to 'production'.
        environment: process.env.NODE_ENV || 'development',

        // Performance tracing — start conservative (10%) to keep within free-tier
        // quota. Bump later if we need higher fidelity perf data.
        tracesSampleRate: 0.1,

        // Don't capture Express's normal 404/4xx as errors — only 5xx + thrown
        // exceptions. Keeps the dashboard signal high.
        ignoreErrors: [/^Not Found$/i],
    });
    // eslint-disable-next-line no-console
    console.log('[Sentry] initialised — env:', process.env.NODE_ENV || 'development');
} else {
    // eslint-disable-next-line no-console
    console.log('[Sentry] SENTRY_DSN not set — Sentry init skipped (SDK calls are no-ops).');
}
