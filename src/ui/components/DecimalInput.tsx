import { useState } from 'react';

interface DecimalInputProps<T> {
  id: string;
  value: T;
  /** Text shown for a committed value. */
  format: (value: T) => string;
  /** The exact value of the typed text, or null when it is not valid. */
  parse: (text: string) => T | null;
  onCommit: (value: T) => void;
  /** Czech message shown while the text does not parse. */
  invalidHint: string;
}

/**
 * A number typed as text (Czech comma, spaces): only a value that parses exactly is committed, so a half-typed or
 * invalid number never becomes an amount. The text is kept as typed until the value changes from outside.
 */
export function DecimalInput<T>({ id, value, format, parse, onCommit, invalidHint }: DecimalInputProps<T>) {
  const [text, setText] = useState(() => format(value));
  const [committed, setCommitted] = useState(value);
  if (committed !== value) {
    setCommitted(value);
    setText(format(value));
  }
  const invalid = parse(text) === null;

  return (
    <>
      <input
        id={id}
        className="input input--num"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parse(event.target.value);
          if (parsed !== null) {
            setCommitted(parsed);
            onCommit(parsed);
          }
        }}
        onBlur={() => {
          if (!invalid) setText(format(committed));
        }}
      />
      {invalid ? (
        <span className="field__hint field__hint--error" id={`${id}-error`} role="alert">
          {invalidHint}
        </span>
      ) : null}
    </>
  );
}
