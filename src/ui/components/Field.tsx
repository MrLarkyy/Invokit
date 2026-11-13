import { cloneElement, isValidElement, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  /** Shown instead of the hint, announced, and marks the control invalid. */
  error?: string | null;
  className?: string;
  /** One control; it gets aria-describedby (and aria-invalid with an error) pointing at the hint. */
  children: ReactNode;
}

interface DescribedProps {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export function Field({ label, htmlFor, hint, error, className = '', children }: FieldProps) {
  const hintId = `${htmlFor}-hint`;
  const text = error ?? hint;
  const control =
    text && isValidElement<DescribedProps>(children)
      ? cloneElement(children, {
          'aria-describedby': hintId,
          ...(error ? { 'aria-invalid': true } : {}),
        })
      : children;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {control}
      {error ? (
        <p className="field__hint field__hint--error" id={hintId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
