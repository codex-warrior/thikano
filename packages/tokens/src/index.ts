/**
 * Habistat design tokens — single source for web + mobile.
 * Web consumes these via CSS variables (packages/web-ui/styles/theme.css mirrors them);
 * mobile imports them directly. Change a value here and in theme.css together.
 */
export const color = {
  navy: {
    950: '#070E22',
    900: '#0B1633',
    800: '#122046',
    700: '#1A2D5E', // primary
    600: '#284079',
    500: '#3D5797',
    300: '#93A3C8',
    200: '#C3CDE3',
    100: '#E4E9F3',
    50: '#F1F4F9',
  },
  /** Brand blue (the logo's accent) — used sparingly for brand moments, never for status. */
  accent: { 600: '#1D4ED8', 500: '#275DFC', 100: '#E7EEFF' },
  /** Logo colours, exact. */
  brand: { navy: '#011C5B', blue: '#275DFC' },
  ink: { 900: '#0D1730', 700: '#2D3850', 500: '#5A6479', 400: '#7D8597', 300: '#A9AFBC' },
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  border: '#E4E3DD',
  borderStrong: '#D3D2CA',
  success: { 600: '#1C7A50', 100: '#E3F3EA' },
  warning: { 600: '#A8650F', 100: '#FBEFD9' },
  danger: { 600: '#B4321F', 100: '#FBE5E1' },
  info: { 600: '#26579E', 100: '#E3ECF8' },
} as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

export const font = {
  display: 'Plus Jakarta Sans',
  body: 'Inter',
} as const;

export const type = {
  display: { size: 32, line: 38, weight: '700' },
  h1: { size: 24, line: 30, weight: '700' },
  h2: { size: 19, line: 26, weight: '650' },
  h3: { size: 16, line: 22, weight: '600' },
  body: { size: 15, line: 22, weight: '400' },
  small: { size: 13, line: 18, weight: '400' },
  micro: { size: 11, line: 14, weight: '600' },
} as const;

export const status = {
  available: { fg: color.success[600], bg: color.success[100], label: 'Available' },
  occupied: { fg: color.navy[700], bg: color.navy[100], label: 'Occupied' },
  reserved: { fg: color.info[600], bg: color.info[100], label: 'Reserved' },
  blocked: { fg: color.ink[500], bg: '#EEEDE8', label: 'Blocked' },
  maintenance: { fg: color.warning[600], bg: color.warning[100], label: 'Maintenance' },
} as const;
