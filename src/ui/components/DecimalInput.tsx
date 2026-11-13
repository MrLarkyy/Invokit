import { useState } from 'react';

interface DecimalInputProps<T> {
  id: string;
  value: T;
  /** Text shown for a committed value. */
  format: (value: T) => string;
  /** The exact value of the typed text within its limits, or null when it is not valid. */
  parse: (text: string) => T | null;
  onCommit: (value: T) => void;
  /** Czech message shown while the text does not parse. */
  invalidHint: string;
  'aria-describedby'?: string;
}

/**
 * A number typed as text (Czech comma, spaces): only a value that parses exactly is committed, so a half-typed or
 * invalid number never becomes an amount. The text is kept as typed until the value changes from outside. While the
 * text is invalid the input carries data-invalid-number, which the editor checks before it saves.
 */
export function DecimalInput<T>(props: DecimalInputProps<T>) {
  const { id, value, format, parse, onCommit, invalidHint } = props;
  const [text, setText] = useState(() => format(value));
  const [committed, setCommitted] = useState(value);
  if (committed !== value) {
    setCommitted(value);
    setText(format(value));
  }
  const invalid = parse(text) === null;
  const errorId = `${id}-error`;
  const describedBy = [props['aria-describedby'], invalid ? errorId : undefined].filter(Boolean).join(' ');

  return (
    <>
      <input
        id={id}
        className="input input--num"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid}
        data-invalid-number={invalid ? '' : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => {
          const next = event.target.value;
          const parsed = parse(next);
          setText(next);
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
        <span className="field__hint field__hint--error" id={errorId} role="alert">
          {invalidHint}
        </span>
      ) : null}
    </>
  );
}
