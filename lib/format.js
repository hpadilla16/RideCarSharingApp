export function fmtMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

export function fmtDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch { return String(value); }
}

export function fmtDateTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch { return String(value); }
}

export function vehicleLabel(listing) {
  if (!listing) return 'Vehicle';
  const v = listing.vehicle;
  if (v) return [v.year, v.make, v.model].filter(Boolean).join(' ');
  return listing.title || 'Vehicle';
}

export function locationLabel(loc) {
  if (!loc) return '';
  return [loc.name, loc.city, loc.state].filter(Boolean).join(' | ');
}
