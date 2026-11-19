const glyphs = {
  logo: '<path d="m12 3 8.5 5v8L12 21l-8.5-5V8L12 3Z"/><path d="m3.5 8 8.5 5 8.5-5M12 13v8m-4.2-9.5v3l4.2 2.4"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.1"/><rect x="14" y="3" width="7" height="7" rx="1.1"/><rect x="3" y="14" width="7" height="7" rx="1.1"/><rect x="14" y="14" width="7" height="7" rx="1.1"/>',
  orders: '<path d="M8 5H5a2 2 0 0 0-2 2v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a2 2 0 0 0-2-2h-3"/><rect x="8" y="3" width="8" height="5" rx="1"/><path d="M8 12h8m-8 4h6"/>',
  customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  products: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5m-9 5v8M7.5 5.5l9 5"/>',
  sql: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  city: '<path d="M3 21h18m-16 0V8h5v13M10 21V3h6v18m0-11h3v11M13 7v1m0 3v1m0 3v1"/>',
  map: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5h-4a1.75 1.75 0 0 0 0 3.5h2a1.75 1.75 0 0 1 0 3.5H9m3-8.5v10"/>',
  average: '<path d="M3 19h18M6 15v-3m4 3V8m4 7V5m4 10V9"/>',
  calendar: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v5m8-5v5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  reset: '<path d="M8 3H4v4m12-4h4v4M8 21H4v-4m12 4h4v-4"/><circle cx="12" cy="12" r="2"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12.5" r="3"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>'
};
export const icon = (name, size = 19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name] ?? ''}</svg>`;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
export const number = new Intl.NumberFormat('en-AE');
const currency = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const aed = value => `AED ${currency.format(Number(value))}`;
export const roundAed = value => `AED ${number.format(Math.round(Number(value)))}`;
export const dateLabel = value => new Intl.DateTimeFormat('en-GB', {
  month: 'short', day: 'numeric', timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00Z`));
export const orderLabel = id => `#${String(id).padStart(4, '0')}`;
export const periods = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 0: 'All time' };
export const periodSelect = days => `<label class="period-control">${icon('calendar', 16)}
  <select aria-label="Date range" id="date-range">${[7,30,90,0].map(value =>
    `<option value="${value}" ${value === days ? 'selected' : ''}>${periods[value]}</option>`).join('')}</select>
  ${icon('chevron', 14)}</label>`;

export async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
