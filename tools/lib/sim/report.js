'use strict';
// Text formatting for `sim` reports.

function fmtH(sec) {
	if (!Number.isFinite(sec) || sec <= 0) return '-';
	return `${(sec / 3600).toFixed(1)}h`;
}

// 4d 03:12 (days of /played, hours:minutes)
function fmtHM(sec) {
	if (!Number.isFinite(sec) || sec <= 0) return '-';
	const m = Math.round(sec / 60);
	const d = Math.floor(m / 1440);
	const h = Math.floor((m % 1440) / 60);
	const mm = m % 60;
	return `${d ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Plain-text table with a header rule; numbers right-aligned.
function table(head, rows) {
	const cells = [head, ...rows].map((r) => r.map((c) => (c == null ? '' : String(c))));
	const w = head.map((_, i) => Math.max(...cells.map((r) => (r[i] || '').length)));
	const num = head.map((_, i) => rows.length > 0 && rows.every((r) => r[i] == null || r[i] === '' || r[i] === '-' || /^-?[\d.,]+[%h]?$/.test(String(r[i]))));
	const line = (r) => r.map((c, i) => (num[i] ? (c || '').padStart(w[i]) : (c || '').padEnd(w[i]))).join('  ').trimEnd();
	return [line(cells[0]), w.map((n) => '-'.repeat(n)).join('  '), ...cells.slice(1).map(line)].join('\n');
}

// Markdown table (for files in data/sim and data/bench).
function mdTable(head, rows) {
	const esc = (c) => String(c == null ? '' : c).replace(/\|/g, '\\|');
	return [`| ${head.map(esc).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}

module.exports = { fmtH, fmtHM, table, mdTable };
