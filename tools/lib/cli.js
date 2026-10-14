'use strict';
// Argument parsing and diagnostics printing shared by the toolchain commands.

const path = require('node:path');
const { FORMATS, format, formatDiagnostics } = require('./dsl/diag');

// parseArgs(argv, { flags: ['--link'], options: ['--dest'] })
// -> { opts: { link: true, dest: '...' }, positional: [], error }
function parseArgs(argv, spec) {
	const opts = {};
	const positional = [];
	const camel = (s) => s.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--help' || a === '-h') {
			opts.help = true;
			continue;
		}
		if (a.startsWith('--')) {
			const eq = a.indexOf('=');
			const name = eq >= 0 ? a.slice(0, eq) : a;
			if ((spec.flags || []).includes(name)) {
				if (eq >= 0) return { opts, positional, error: `${name} takes no value` };
				opts[camel(name)] = true;
				continue;
			}
			if ((spec.options || []).includes(name)) {
				const value = eq >= 0 ? a.slice(eq + 1) : argv[++i];
				if (value === undefined || value === '') return { opts, positional, error: `${name} needs a value` };
				opts[camel(name)] = value;
				continue;
			}
			return { opts, positional, error: `unknown option ${name}` };
		}
		positional.push(a);
	}
	return { opts, positional, error: null };
}

function resolvePath(value, fallbackFromRoot, root) {
	return value ? path.resolve(value) : path.join(root, fallbackFromRoot);
}

// diag: a Diagnostics, or an array of diagnostics already in order (pack.json's).
// `format` (FORMATS): text goes to stderr, one line (plus its hint) per
// diagnostic; json (one document) and github annotations go to stdout.
// `quiet` leaves the warnings out; json still counts them.
function printDiagnostics(diag, { quiet = false, format: fmt = 'text' } = {}) {
	const all = Array.isArray(diag) ? diag : diag.sorted();
	const items = all.filter((d) => !(quiet && d.severity === 'warning'));
	if (fmt === 'json') {
		console.log(formatDiagnostics(items, 'json', all));
		return;
	}
	if (fmt === 'github') {
		if (items.length) console.log(formatDiagnostics(items, 'github'));
		return;
	}
	for (const d of items) (d.severity === 'error' ? console.error : console.warn)(format(d));
}

// The --format option's error, or null.
function formatError(value) {
	return value === undefined || FORMATS.includes(value) ? null : `unknown --format ${value} (use ${FORMATS.join(', ')})`;
}

function plural(n, word) {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

module.exports = { parseArgs, resolvePath, printDiagnostics, formatError, plural };
