// Central error/event logging.
// Console-based for now. To enable Sentry later:
//   npx expo install @sentry/react-native
//   set EXPO_PUBLIC_SENTRY_DSN in .env, then uncomment the Sentry lines.
//
// import * as Sentry from '@sentry/react-native';
// const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
// if (SENTRY_DSN) Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });

export function logError(error, context = {}) {
  const message = error?.message || String(error);
  console.error(`[ride] ${message}`, Object.keys(context).length ? context : '');
  // if (SENTRY_DSN) Sentry.captureException(error, { extra: context });
}

export function logWarn(message, context = {}) {
  console.warn(`[ride] ${message}`, Object.keys(context).length ? context : '');
  // if (SENTRY_DSN) Sentry.captureMessage(message, { level: 'warning', extra: context });
}
