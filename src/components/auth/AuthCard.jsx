import { memo } from 'react';
import { motion } from 'framer-motion';

function AuthCard({ children, className = '', ...props }) {
  return (
    <motion.div
      role="region"
      aria-label="Authentication"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={['login-card', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="login-card__accent" aria-hidden="true" />
      {children}
    </motion.div>
  );
}

export default memo(AuthCard);
