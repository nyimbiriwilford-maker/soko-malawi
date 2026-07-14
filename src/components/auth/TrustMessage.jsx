import { memo } from 'react';
import { ShieldCheck } from 'lucide-react';

function TrustMessage({ className = '' }) {
  return (
    <p
      className={['login-trust', className].filter(Boolean).join(' ')}
      aria-label="Secure login and verified marketplace"
    >
      <span className="inline-flex items-center gap-1">
        <ShieldCheck size={13} className="text-[#16A34A]" aria-hidden="true" />
        Secure Login
      </span>
      <span className="login-trust__dot" aria-hidden="true">
        ·
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="text-[#16A34A]" aria-hidden="true">
          ✓
        </span>
        Verified Marketplace
      </span>
    </p>
  );
}

export default memo(TrustMessage);
