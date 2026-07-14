import { memo } from 'react';
import { Link } from 'react-router-dom';

function FooterLinks({
  prompt = "Don't have an account?",
  linkText = 'Create Account',
  to = '/signup',
  onClick,
  className = '',
}) {
  return (
    <p className={['login-footer', className].filter(Boolean).join(' ')}>
      {prompt}{' '}
      {typeof onClick === 'function' ? (
        <button type="button" onClick={onClick} className="login-footer__link">
          {linkText}
        </button>
      ) : (
        <Link to={to} className="login-footer__link">
          {linkText}
        </Link>
      )}
    </p>
  );
}

export default memo(FooterLinks);
