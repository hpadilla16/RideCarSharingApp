export interface Vehicle {
  year?: number | string;
  make?: string;
  model?: string;
}

export interface ListingLike {
  title?: string;
  vehicle?: Vehicle | null;
}

export interface LocationLike {
  name?: string;
  city?: string;
  state?: string;
}

export function fmtMoney(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

export function fmtDate(value: string | number | Date | null | undefined): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(value)
    );
  } catch {
    return String(value);
  }
}

export function fmtDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function vehicleLabel(listing: ListingLike | null | undefined): string {
  if (!listing) return 'Vehicle';
  const v = listing.vehicle;
  if (v) return [v.year, v.make, v.model].filter(Boolean).join(' ');
  return listing.title || 'Vehicle';
}

export function locationLabel(loc: LocationLike | null | undefined): string {
  if (!loc) return '';
  return [loc.name, loc.city, loc.state].filter(Boolean).join(' | ');
}
