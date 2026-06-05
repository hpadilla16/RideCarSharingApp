// Form validation helpers — kept dependency-free so they're trivially testable.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[\d\s().-]{7,17}$/;

export interface CustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export function isValidEmail(value: string | null | undefined): boolean {
  return EMAIL_RE.test(String(value || '').trim());
}

export function isValidPhone(value: string | null | undefined): boolean {
  return PHONE_RE.test(String(value || '').trim());
}

// Returns '' when valid, otherwise a user-facing message.
export function validateCustomerInfo(customer: CustomerInfo = {}): string {
  const { firstName = '', lastName = '', email = '', phone = '' } = customer;
  if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
    return 'Please fill all fields';
  }
  if (!isValidEmail(email)) return 'Please enter a valid email address';
  if (!isValidPhone(phone)) return 'Please enter a valid phone number';
  return '';
}
