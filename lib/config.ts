// Single source of truth for app configuration.
// Set EXPO_PUBLIC_API_BASE in .env to point at staging/local backends.
export const API_BASE: string = process.env.EXPO_PUBLIC_API_BASE || 'https://ridefleetmanager.com';

export const API_HOST: string = (() => {
  try {
    return new URL(API_BASE).hostname;
  } catch {
    return 'ridefleetmanager.com';
  }
})();

// Hosts the payment WebView is allowed to navigate to.
// Backend gateways: PayArc (US mainland) and Authorize.Net Accept Hosted.
export const PAYMENT_ALLOWED_HOSTS: string[] = [
  API_HOST,
  'secure.payarc.net',
  'api.payarc.net',
  'testapi.payarc.net',
  'accept.authorize.net',
  'test.authorize.net',
  'api2.authorize.net',
  'apitest.authorize.net',
];

// Backend's own payment return pages (see RideFleetManagement
// public-booking.routes.js: /trips/:tripCode/payment-return|cancel).
export const PAYMENT_SUCCESS_PATH = '/payment-return';
export const PAYMENT_CANCEL_PATH = '/payment-cancel';
