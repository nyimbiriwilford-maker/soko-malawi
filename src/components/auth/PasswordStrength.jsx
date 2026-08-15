import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getPasswordStrength } from '../../utils/validation';

const RULES = [
  { key: 'length', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'An uppercase letter (A-Z)' },
  { key: 'lowercase', label: 'A lowercase letter (a-z)' },
  { key: 'number', label: 'A number (0-9)' },
  { key: 'special', label: 'A special character (!@#$…)' },
];

const COLORS = {
  0: { bar: '#f87171', text: '#f87171', label: 'Weak' },
  1: { bar: '#fbbf24', text: '#fbbf24', label: 'Weak' },
  2: { bar: '#fb923c', text: '#fb923c', label: 'Fair' },
  3: { bar: '#4ade80', text: '#4ade80', label: 'Good' },
  4: { bar: '#22c55e', text: '#22c55e', label: 'Strong' },
};

function PasswordStrength({ value = '', show = true }) {
  const { score, label, criteria } = getPasswordStrength(value);
  const color = COLORS[score];
  const active = show && value.length > 0;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="strength"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          style={{ overflow: 'hidden' }}
        >
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              margin: '8px 2px 4px',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: 0.2,
              color: color.text,
            }}
          >
            <span>Password strength</span>
            <span style={{ textTransform: 'capitalize' }}>{label}</span>
          </div>

          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: '#e2e8f0',
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((score + 1) / 5) * 100}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 999, background: color.bar }}
            />
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
            {RULES.map((rule) => {
              const met = criteria[rule.key];
              return (
                <li
                  key={rule.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: met ? '#16a34a' : '#94a3b8',
                    fontWeight: met ? 600 : 400,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      background: met ? '#dcfce7' : '#f1f5f9',
                      color: met ? '#16a34a' : '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    {met ? '✓' : '•'}
                  </span>
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(PasswordStrength);
