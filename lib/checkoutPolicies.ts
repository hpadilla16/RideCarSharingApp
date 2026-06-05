// Checkout-critical pure logic, extracted from the checkout screen so it
// can be unit-tested: payment WebView URL allowlisting and the mapping of
// backend /policies responses (protection tiers, add-ons) to UI shapes.
import { PAYMENT_ALLOWED_HOSTS } from './config';

export interface Tier {
  id: string;
  label: string;
  price: string;
  desc: string;
  deductible?: string;
  limit?: string;
  recommended?: boolean;
}

export interface Addon {
  id: string;
  label: string;
  price: string;
  desc: string;
}

export interface ApiTier {
  id: string;
  label?: string;
  description?: string;
  pricePerDay?: number | string;
  deductibleReimbursementMax?: number | string;
  roadsideAssistance?: boolean;
}

export interface ApiAddon {
  id: string;
  label?: string;
  description?: string;
  pricePerDay?: number | string;
  hostOffered?: boolean;
  covers?: string[];
}

export const ADDON_EMOJI: Record<string, string> = {
  TIRE_PROTECTION: '🛞',
  GLASS_PROTECTION: '🪟',
  ROADSIDE_ASSISTANCE: '🚨',
  TOLL_PASS: '🛣',
};

export function fmtPerDay(pricePerDay: number | string | null | undefined): string {
  const n = Number(pricePerDay || 0);
  if (n <= 0) return 'Free';
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}/day`;
}

export function tiersFromApi(apiTiers: Record<string, ApiTier> | null | undefined): Tier[] | null {
  if (!apiTiers || typeof apiTiers !== 'object') return null;
  const list: Tier[] = ['BASIC', 'STANDARD', 'PREMIUM']
    .map((id) => apiTiers[id])
    .filter(Boolean)
    .map((t) => ({
      id: t.id,
      label: t.label || t.id,
      price: fmtPerDay(t.pricePerDay),
      desc: t.description || '',
      deductible:
        Number(t.deductibleReimbursementMax) > 0
          ? `Up to $${Number(t.deductibleReimbursementMax).toLocaleString()}`
          : 'N/A',
      limit:
        Number(t.deductibleReimbursementMax) > 0
          ? `Host deductible${t.roadsideAssistance ? ' + roadside' : ''}`
          : 'N/A',
      recommended: t.id === 'STANDARD',
    }));
  return list.length >= 2 ? list : null;
}

export function addonsFromApi(apiAddons: Record<string, ApiAddon> | null | undefined): Addon[] | null {
  if (!apiAddons || typeof apiAddons !== 'object') return null;
  const list: Addon[] = Object.values(apiAddons)
    .filter((a) => a && a.id && a.hostOffered !== false)
    .map((a) => ({
      id: a.id,
      label: `${ADDON_EMOJI[a.id] || '✚'} ${a.label || a.id}`,
      price: fmtPerDay(a.pricePerDay),
      desc: Array.isArray(a.covers) && a.covers.length ? a.covers.join(', ') : a.description || '',
    }));
  return list.length ? list : null;
}

// Only https URLs on the API host or known payment-gateway hosts may load
// inside the payment WebView (about: is allowed for the initial blank page).
// Subdomains of allowed hosts are accepted; lookalike domains are not.
export function isAllowedPaymentUrl(
  url: string | null | undefined,
  allowedHosts: string[] = PAYMENT_ALLOWED_HOSTS
): boolean {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'about:') return false;
    return (
      u.protocol === 'about:' ||
      allowedHosts.some((host) => u.hostname === host || u.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}
