'use strict';
// Diagnostics: errors fail compile/lint, warnings print. Each carries the
// source file (as given) and a 1-based line so authors can jump to it.

class Diagnostics {
	constructor() {
		this.list = [];
	}

	error(file, line, message) {
		this.list.push({ severity: 'error', file, line: line || 0, message });
	}

	warn(file, line, message) {
		this.list.push({ severity: 'warning', file, line: line || 0, message });
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

function format(d) {
	const where = d.file ? (d.line ? `${d.file}:${d.line}: ` : `${d.file}: `) : '';
	return `${where}${d.severity}: ${d.message}`;
}

module.exports = { Diagnostics, format };
