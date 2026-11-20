// Schema-driven validation shared by the browser form and the server.
// stage: 'draft'   -> only format checks (lengths, numbers), nothing required
//        'submit'  -> stakeholder submission: required fields enforced (admin-only fields skipped)
//        'generate'-> everything, including admin-only fields marked requiredForGeneration
import { parseMonth } from './derive.js';

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export function defaultValue(field) {
  if (field.type === 'list') return [];
  if (field.type === 'repeater') return field.defaultItems ? JSON.parse(JSON.stringify(field.defaultItems)) : [];
  return field.default !== undefined ? field.default : '';
}

export function emptyData(template) {
  const out = {};
  for (const f of template.fields) out[f.key] = defaultValue(f);
  return out;
}

function isRequired(field, data, stage) {
  if (stage === 'draft') return false;
  if (field.adminOnly) return stage === 'generate' && !!field.requiredForGeneration;
  if (field.required) return true;
  if (field.requiredIf) return data[field.requiredIf.field] === field.requiredIf.equals;
  return false;
}

function checkScalar(field, value, required) {
  if (isBlank(value)) return required ? 'Required' : null;
  const s = String(value);
  switch (field.type) {
    case 'text':
    case 'textarea':
      if (field.maxLength && s.length > field.maxLength) return `Max ${field.maxLength} characters (currently ${s.length}) – longer text will not fit the template`;
      if (field.pattern && !new RegExp(field.pattern).test(s)) return field.patternMessage || 'Invalid format';
      return null;
    case 'number': {
      const n = Number(value);
      if (!Number.isFinite(n)) return 'Must be a number';
      if (field.integer && !Number.isInteger(n)) return 'Whole numbers only';
      if (field.min !== undefined && n < field.min) return `Minimum ${field.min}`;
      if (field.max !== undefined && n > field.max) return `Maximum ${field.max}`;
      return null;
    }
    case 'month':
      return parseMonth(s) ? null : 'Use the month picker (YYYY-MM)';
    case 'color':
      return /^#[0-9a-fA-F]{6}$/.test(s) ? null : 'Use a hex colour like #4F46E5';
    case 'select':
      return field.options.some((o) => o.value === s) ? null : 'Choose an option';
    case 'image':
      return /^[a-z0-9-]{8,}$/.test(s) ? null : 'Upload an image';
    default:
      return null;
  }
}

/** Returns { [path]: message }. Paths: "key", "key.0", "key.0.sub". Empty object = valid. */
export function validate(template, data, stage = 'submit') {
  const errors = {};
  data = data || {};
  for (const field of template.fields) {
    const value = data[field.key];
    const required = isRequired(field, data, stage);

    if (field.type === 'list') {
      const items = (Array.isArray(value) ? value : []).map((v) => (typeof v === 'string' ? v.trim() : v));
      const filled = items.filter((v) => !isBlank(v));
      if (required && filled.length < (field.minItems || 1)) errors[field.key] = `Add at least ${field.minItems || 1} ${(field.itemLabel || 'item').toLowerCase()}${(field.minItems || 1) > 1 ? 's' : ''}`;
      if (field.maxItems && filled.length > field.maxItems) errors[field.key] = `The template has room for ${field.maxItems} at most`;
      items.forEach((v, i) => {
        if (!isBlank(v) && field.itemMaxLength && String(v).length > field.itemMaxLength) errors[`${field.key}.${i}`] = `Max ${field.itemMaxLength} characters`;
      });
      if (field.maxTotalLength && filled.join('').length > field.maxTotalLength && !errors[field.key]) errors[field.key] = `Combined text is too long for one row (max ${field.maxTotalLength} characters in total)`;
      continue;
    }

    if (field.type === 'repeater') {
      const items = Array.isArray(value) ? value : [];
      if (required && items.length < (field.minItems || 1)) errors[field.key] = `Add at least ${field.minItems || 1} ${(field.itemLabel || 'item').toLowerCase()}${(field.minItems || 1) > 1 ? 's' : ''}`;
      if (field.maxItems && items.length > field.maxItems) errors[field.key] = `The template has room for ${field.maxItems} at most`;
      items.forEach((item, i) => {
        for (const sub of field.itemFields) {
          // Inside a row that exists, the row's own required fields always apply (except while drafting).
          const msg = checkScalar(sub, item ? item[sub.key] : undefined, stage !== 'draft' && !!sub.required);
          if (msg) errors[`${field.key}.${i}.${sub.key}`] = msg;
        }
      });
      if (field.rule === 'ascendingMonths') {
        let prev = -Infinity;
        items.forEach((item, i) => {
          const p = parseMonth(item && item.month);
          if (!p) return;
          if (p.index <= prev) errors[`${field.key}.${i}.month`] = 'Months must be unique and in ascending order';
          prev = p.index;
        });
        if (stage !== 'draft' && items.length && items.every((r) => !(Number(r.engineering) + Number(r.qa) + Number(r.data_other)))) {
          errors[field.key] = 'At least one month needs resources greater than 0';
        }
      }
      continue;
    }

    const msg = checkScalar(field, value, required);
    if (msg) errors[field.key] = msg;
  }

  // Cross-field rules
  if (template.id === 'staffing') {
    const s = parseMonth(data.period_start), e = parseMonth(data.period_end);
    if (s && e && e.index < s.index) errors.period_end = 'End month is before the start month';
  }
  return errors;
}
