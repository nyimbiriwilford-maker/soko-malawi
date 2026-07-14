import { memo, useId } from 'react';
import { Check } from 'lucide-react';

function Checkbox({
  id: idProp,
  name,
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) {
  const reactId = useId();
  const id = idProp || reactId;

  return (
    <label
      htmlFor={id}
      className={['login-check', disabled ? 'opacity-60 cursor-not-allowed' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={typeof label === 'string' ? label : 'Checkbox'}
        className="login-check__input"
      />
      <span className="login-check__box" aria-hidden="true">
        <Check
          size={11}
          strokeWidth={3}
          className={`text-white transition-opacity duration-150 ${
            checked ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
      {label && <span className="login-check__text">{label}</span>}
    </label>
  );
}

export default memo(Checkbox);
