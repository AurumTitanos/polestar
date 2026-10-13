'use strict';
// Diagnostics: errors fail compile/lint, warnings print. Each carries the
// source file (as given), a 1-based line so authors can jump to it, and
// optionally a `hint` saying how to fix it.

class Diagnostics {
	constructor() {
		this.list = [];
	}

	error(file, line, message, hint) {
		this.list.push(make('error', file, line, message, hint));
	}

	warn(file, line, message, hint) {
		this.list.push(make('warning', file, line, message, hint));
	}

	get errors() {
		return this.list.filter((d) => d.severity === 'error');
	}

	get warnings() {
		return this.list.filter((d) => d.severity === 'warning');
	}

	hasErrors() {
		return this.list.some((d) => d.severity === 'error');
	}

	// Stable order: by file, line, then errors before warnings, then insertion.
	sorted() {
		return this.list
			.map((d, i) => ({ d, i }))
			.sort((a, b) => {
				const fa = a.d.file || '';
				const fb = b.d.file || '';
				if (fa !== fb) return fa < fb ? -1 : 1;
				if (a.d.line !== b.d.line) return a.d.line - b.d.line;
				if (a.d.severity !== b.d.severity) return a.d.severity === 'error' ? -1 : 1;
				return a.i - b.i;
			})
			.map((x) => x.d);
	}
}

function make(severity, file, line, message, hint) {
	const d = { severity, file, line: line || 0, message };
	if (hint) d.hint = hint;
	return d;
}

// Output formats of compile and lint (`--format`).
const FORMATS = ['text', 'json', 'github'];

// One diagnostic as text: `file:line: severity: message`, then `  hint: <hint>`.
function format(d) {
	const where = d.file ? (d.line ? `${d.file}:${d.line}: ` : `${d.file}: `) : '';
	return `${where}${d.severity}: ${d.message}${d.hint ? `\n  hint: ${d.hint}` : ''}`;
}

// GitHub workflow commands: data escapes %, CR and LF; property values also `:` and `,`.
function ghData(s) {
	return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function ghProp(s) {
	return ghData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function github(d) {
	const props = [];
	if (d.file) props.push(`file=${ghProp(d.file)}`);
	if (d.file && d.line) props.push(`line=${d.line}`);
	const text = `${d.message}${d.hint ? ` (hint: ${d.hint})` : ''}`;
	return `::${d.severity === 'error' ? 'error' : 'warning'}${props.length ? ` ${props.join(',')}` : ''}::${ghData(text)}`;
}

// items (in order) -> the output in `fmt`: text lines; one JSON document
// { ok, errors, warnings, diagnostics: [{ file, line, severity, message, hint? }] }
// with the counts over `counted` (every diagnostic, when `items` leaves some
// out); or one GitHub annotation per line.
function formatDiagnostics(items, fmt = 'text', counted = items) {
	if (fmt === 'json') {
		const errors = counted.filter((d) => d.severity === 'error').length;
		const diagnostics = items.map((d) => {
			const o = { file: d.file || null, line: d.line || 0, severity: d.severity, message: d.message };
			if (d.hint) o.hint = d.hint;
			return o;
		});
		return JSON.stringify({ ok: errors === 0, errors, warnings: counted.length - errors, diagnostics }, null, '\t');
	}
	if (fmt === 'github') return items.map(github).join('\n');
	return items.map(format).join('\n');
}

module.exports = { Diagnostics, FORMATS, format, formatDiagnostics };
