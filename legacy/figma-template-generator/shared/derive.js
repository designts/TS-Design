// Values calculated from submitted data (never typed by stakeholders), so the
// headline numbers on the slides can't disagree with the chart.
// Shared by the browser (live preview of figures) and the server (compilation).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseMonth(v) {
  const m = /^(\d{4})-(\d{2})$/.exec(v || '');
  if (!m) return null;
  const year = +m[1], month = +m[2];
  if (month < 1 || month > 12) return null;
  return { year, month, index: year * 12 + (month - 1) };
}

export function monthLabel(v, withYear = true) {
  const p = parseMonth(v);
  if (!p) return '';
  return withYear ? `${MONTHS[p.month - 1]} ${p.year}` : MONTHS[p.month - 1];
}

const rowTotal = (r) => (Number(r.engineering) || 0) + (Number(r.qa) || 0) + (Number(r.data_other) || 0);

export function deriveStaffing(data) {
  const rows = Array.isArray(data.monthly_deployment) ? data.monthly_deployment.filter((r) => parseMonth(r.month)) : [];
  const totals = rows.map(rowTotal);
  const start = parseMonth(data.period_start);
  const end = parseMonth(data.period_end);
  const lastRow = rows.length ? parseMonth(rows[rows.length - 1].month) : null;

  let period_label = '';
  if (start) {
    const endText = end ? monthLabel(data.period_end) : data.engagement_status === 'completed' ? '' : 'Present';
    period_label = endText ? `${monthLabel(data.period_start)} – ${endText}` : monthLabel(data.period_start);
  }

  // Duration: explicit end month, otherwise the latest month that has deployment data.
  const durationEnd = end || lastRow;
  const duration_months = start && durationEnd && durationEnd.index >= start.index ? String(durationEnd.index - start.index + 1) : '';

  return {
    period_label,
    duration_months,
    initial_team: totals.length ? String(totals[0]) : '',
    peak_team: totals.length ? String(Math.max(...totals)) : '',
    final_team: totals.length ? String(totals[totals.length - 1]) : '',
  };
}

export function derive(templateId, data) {
  if (templateId === 'staffing') return deriveStaffing(data || {});
  return {};
}
