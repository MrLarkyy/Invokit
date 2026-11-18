import { TEMPLATES, type TemplateId } from '../../domain/invoiceAppearance';

interface TemplatePickerProps {
  /** The radio group name, unique on the page. */
  name: string;
  legend: string;
  value: TemplateId;
  onChange: (template: TemplateId) => void;
  hint?: string;
}

/** The print templates as a native radio group: arrow keys move between them, a screen reader names the group. */
export function TemplatePicker({ name, legend, value, onChange, hint }: TemplatePickerProps) {
  const hintId = `${name}-hint`;
  return (
    <fieldset className="templates" aria-describedby={hint ? hintId : undefined}>
      <legend className="field__label">{legend}</legend>
      <div className="templates__options">
        {TEMPLATES.map((template) => (
          <label key={template.id} className="templates__option">
            <input
              type="radio"
              name={name}
              value={template.id}
              checked={value === template.id}
              onChange={() => onChange(template.id)}
            />
            <span className="templates__text">
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </span>
          </label>
        ))}
      </div>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
