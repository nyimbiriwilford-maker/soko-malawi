/**
 * SokoMw auth theme tokens.
 * Maps to Tailwind utilities; ready for future dark-mode overrides.
 */
export const authTokens = {
  brand: {
    green: 'text-green-600',
    greenBg: 'bg-green-600',
    greenHover: 'hover:bg-green-700',
    greenActive: 'active:bg-green-800',
    gold: 'text-amber-500',
  },
  surface: {
    page: 'bg-[#F6F8F7]',
    card: 'bg-white dark:bg-slate-900',
  },
  text: {
    primary: 'text-gray-900 dark:text-gray-100',
    muted: 'text-gray-500 dark:text-gray-400',
    placeholder: 'text-gray-400',
  },
  border: {
    default: 'border-gray-200 dark:border-slate-700',
    focus: 'border-green-600',
    error: 'border-red-600',
  },
  focusRing: 'focus-visible:ring-4 focus-visible:ring-green-600/20',
  radii: {
    card: 'rounded-3xl',
    control: 'rounded-2xl',
  },
};
