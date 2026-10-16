'use strict';
// i18n: Polestar's interface translations (docs/TRANSLATING.md), the files
// addon/Polestar/Locales/<locale>.lua. Adapted from Ding! by Yendi
// (@moust4ki), GPL-3.0: https://github.com/moust4ki/DingGuideWoWForever

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, plural } = require('../lib/cli');
const { ROOT } = require('../lib/paths');
const { LOCALES, LOCALE_CODES, checkLocale } = require('../lib/i18n/locales');
const { localeState, syncFiles, rel } = require('../lib/i18n/project');

const ADDON = path.join(ROOT, 'addon', 'Polestar');

const usage = `usage: node tools/polestar.js i18n <status|check|sync|keys|import> [options]

Polestar's interface translations (docs/TRANSLATING.md): one file per
locale, addon/Polestar/Locales/<locale>.lua. Locales: ${LOCALE_CODES.join(', ')}.

  i18n status                per locale: its language, status (reviewed or
                             ai), translators, and how many keys it
                             translates. --markdown prints a table for the
                             README and release notes.
  i18n check [<locale>...]   fails (exit 1) on a file Lua cannot load, a
                             stale key (one the code no longer has), a key
                             set twice, or a translation whose %s/%d/%1$s,
                             |4one:many; or |c/|r/|T escapes differ from the
                             English. Warns where a translation leaves out its
                             glossary's word (tools/lib/i18n/glossary). Missing
                             translations are fine: the English shows.
  i18n sync [<locale>...]    adds the keys the code gained to each file as
                             -- L["English"] = "" lines under their file's
                             group, and moves translations of keys it lost to
                             a commented block at the end. Never rewrites a
                             translation. A locale named that has no file
                             gets one, loaded from Core/Core.xml.
  i18n keys                  every interface key with where it is used.
  i18n import <locale> <file.lua>...
                             merges translations written apart (a file that
                             returns { ["English"] = "translation" }, sets
                             L["English"], or calls ns.AddTranslations) into
                             the locale's file: only into keys not translated
                             yet; a broken format is refused; keys the code
                             lacks go to the commented block at the end.

options:
  --json            status, check, keys: one JSON document on stdout
  --markdown        status: a Markdown table`;

function locales(positional) {
	if (!positional.length) return LOCALE_CODES.slice();
	return positional.map(checkLocale);
}

function count(o) {
	return Object.keys(o).length;
}

// Locales/<x>.lua files that are not one of LOCALES.
function strayFiles() {
	const dir = path.join(ADDON, 'Locales');
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter((f) => f.endsWith('.lua') && !LOCALES[f.replace(/\.lua$/, '')]).map((f) => path.join(dir, f));
}

function runStatus(opts) {
	const st = localeState(ADDON, LOCALE_CODES);
	const total = st.keys.size;
	const rows = LOCALE_CODES.map((locale) => {
		const s = st.locales[locale];
		const meta = LOCALES[locale];
		return { locale, language: meta.language, status: meta.status, translators: meta.translators, file: s.exists, translated: count(s.translated), keys: total };
	});
	if (opts.json) {
		console.log(JSON.stringify({ keys: total, locales: rows }, null, 1));
		return 0;
	}
	const pct = (r) => `${Math.floor((r.translated / r.keys) * 100)}%`;
	if (opts.markdown) {
		console.log('| Language | Locale | Translated | Status | Translators |');
		console.log('|---|---|---|---|---|');
		for (const r of rows) {
			const done = r.file ? `${r.translated}/${r.keys} (${pct(r)})` : 'not yet';
			console.log(`| ${r.language} | ${r.locale} | ${done} | ${r.status === 'ai' ? 'AI-made' : 'reviewed'} | ${r.translators.join(', ') || '-'} |`);
		}
		return 0;
	}
	console.log(`${total} interface keys`);
	for (const r of rows) {
		const done = r.file ? `${r.translated}/${r.keys} (${pct(r)})` : 'no file yet';
		console.log(`${r.locale}  ${r.language.padEnd(24)}${done.padEnd(18)}${r.status.padEnd(10)}${r.translators.join(', ')}`);
	}
	return 0;
}

function runCheck(opts, positional) {
	const list = locales(positional);
	const st = localeState(ADDON, list);
	const report = { ok: true, keys: st.keys.size, locales: {} };
	let failures = 0;
	const fail = (msg) => {
		failures++;
		if (!opts.json) console.error(`error: ${msg}`);
	};
	if (!positional.length) for (const f of strayFiles()) fail(`${rel(f)}: not a locale Polestar ships (tools/lib/i18n/locales.js)`);
	for (const locale of list) {
		const s = st.locales[locale];
		const file = rel(s.file);
		const r = { file, exists: s.exists, translated: count(s.translated), missing: s.missing.length, stale: Object.keys(s.stale), problems: s.problems, warnings: s.warnings, error: s.error };
		report.locales[locale] = r;
		if (!s.exists) {
			if (!opts.json) console.log(`${locale}: no file yet (\`node tools/polestar.js i18n sync ${locale}\` starts one)`);
			continue;
		}
		if (s.error) fail(`${file}: ${s.error}`);
		for (const k of r.stale) fail(`${file}: stale key ${JSON.stringify(k)} (not in the code; \`i18n sync ${locale}\` moves it to the end as a comment)`);
		for (const p of s.problems) fail(`${file}: ${JSON.stringify(p.key)}: ${p.problem}`);
		if (!opts.json) {
			for (const w of s.warnings) console.warn(`warning: ${file}: ${JSON.stringify(w.key)} = ${JSON.stringify(w.value)}: the glossary says "${w.term}" for ${w.id}`);
			console.log(`${locale}: ${r.translated}/${st.keys.size} translated, ${r.missing} missing${r.stale.length ? `, ${r.stale.length} stale` : ''}${s.warnings.length ? `, ${plural(s.warnings.length, 'glossary warning')}` : ''}`);
		}
	}
	report.ok = failures === 0;
	if (opts.json) console.log(JSON.stringify(report, null, 1));
	else if (failures) console.error(`i18n check failed: ${plural(failures, 'problem')}`);
	return failures ? 1 : 0;
}

// The Core/Core.xml line that loads a locale file, added after the last one.
function loadInCoreXml(locale) {
	const xml = path.join(ADDON, 'Core', 'Core.xml');
	const text = fs.readFileSync(xml, 'utf8');
	const line = `\t<Script file="..\\Locales\\${locale}.lua"/>`;
	if (text.includes(line)) return false;
	const lines = text.split('\n');
	let at = -1;
	lines.forEach((l, i) => {
		if (l.includes('file="..\\Locales\\')) at = i;
	});
	if (at < 0) at = lines.findIndex((l) => l.includes('file="Init.lua"'));
	lines.splice(at + 1, 0, line);
	fs.writeFileSync(xml, lines.join('\n'));
	return true;
}

function writeSync(files) {
	let written = 0;
	for (const [file, r] of Object.entries(files)) {
		if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === r.text) continue;
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const created = !fs.existsSync(file);
		fs.writeFileSync(file, r.text);
		if (created && loadInCoreXml(path.basename(file, '.lua'))) console.log(`Core/Core.xml loads ${rel(file)}`);
		written++;
	}
	return written;
}

function runSync(opts, positional) {
	const list = positional.length ? locales(positional) : LOCALE_CODES.filter((l) => fs.existsSync(path.join(ADDON, 'Locales', `${l}.lua`)));
	const st = localeState(ADDON, list);
	let code = 0;
	for (const locale of list) {
		const s = st.locales[locale];
		if (s.error) {
			console.error(`error: ${rel(s.file)}: ${s.error}; fix it first (nothing written for ${locale})`);
			code = 1;
		}
	}
	const files = syncFiles(st, { create: positional.length ? list : [] });
	for (const [file, r] of Object.entries(files)) {
		const parts = [];
		if (r.added.length) parts.push(`${plural(r.added.length, 'key')} added`);
		if (r.retired.length) parts.push(`${plural(r.retired.length, 'translation')} of keys the code lost moved to the end`);
		if (r.dropped.length) parts.push(`${plural(r.dropped.length, 'untranslated key')} the code lost removed`);
		if (parts.length) console.log(`${rel(file)}: ${parts.join(', ')}`);
	}
	console.log(`${plural(writeSync(files), 'file')} written`);
	return code;
}

function runKeys(opts) {
	const { extractKeys } = require('../lib/i18n/keys');
	const keys = extractKeys(ADDON);
	const where = (w) => w.map((x) => (x.data ? `${x.file} (data)` : `${x.file}:${x.line}`));
	if (opts.json) {
		console.log(JSON.stringify(Object.fromEntries([...keys].map(([k, w]) => [k, where(w)])), null, 1));
		return 0;
	}
	for (const [k, w] of keys) console.log(`${JSON.stringify(k)}\t${where(w).join(', ')}`);
	console.log(`${keys.size} keys`);
	return 0;
}

function runImport(opts, positional) {
	const [locale, ...files] = positional;
	if (!locale || !files.length) {
		console.error(usage);
		return 2;
	}
	checkLocale(locale);
	const { readLocaleFiles } = require('../lib/i18n/files');
	const { formatProblems } = require('../lib/i18n/check');
	const st = localeState(ADDON, [locale]);
	const s = st.locales[locale];
	if (s.error) throw new Error(`${rel(s.file)}: ${s.error}`);
	const fill = {};
	const retire = {};
	let bad = 0;
	for (const r of readLocaleFiles(files.map((f) => ({ file: path.resolve(f), locale })))) {
		if (!r.ok) {
			console.error(`error: ${rel(r.file)}: ${r.error}`);
			bad++;
			continue;
		}
		for (const [k, v] of Object.entries(r.strings)) {
			if (v === '') continue;
			if (!st.keys.has(k)) {
				retire[k] = v;
				continue;
			}
			const problems = formatProblems(k, v);
			if (problems.length) {
				console.error(`error: ${rel(r.file)}: ${JSON.stringify(k)}: ${problems.join('; ')}`);
				bad++;
				continue;
			}
			fill[k] = v;
		}
	}
	const out = syncFiles(st, { create: [locale], fill: { [locale]: fill }, retire: { [locale]: retire } });
	writeSync(out);
	const r = out[s.file];
	console.log(`${locale}: ${plural(r.filled.length, 'translation')} imported into ${rel(s.file)}`
		+ `${r.kept.length ? `, ${plural(r.kept.length, 'key')} kept as translated before` : ''}`
		+ `${r.retired.length ? `, ${plural(r.retired.length, 'key')} the code lacks put in the block at the end` : ''}`
		+ `${bad ? `, ${plural(bad, 'problem')}` : ''}`);
	return bad ? 1 : 0;
}

async function run(argv) {
	const { opts, positional, error } = parseArgs(argv, { flags: ['--json', '--markdown'] });
	const [sub, ...rest] = positional;
	if (error || !sub) {
		console.error(`${error || 'i18n needs a subcommand'}\n\n${usage}`);
		return 2;
	}
	try {
		if (sub === 'status') return runStatus(opts);
		if (sub === 'check') return runCheck(opts, rest);
		if (sub === 'sync') return runSync(opts, rest);
		if (sub === 'keys') return runKeys(opts);
		if (sub === 'import') return runImport(opts, rest);
	} catch (e) {
		console.error(`error: ${e.message}`);
		return 1;
	}
	console.error(`unknown i18n subcommand "${sub}"\n\n${usage}`);
	return 2;
}

module.exports = { name: 'i18n', summary: 'interface translations: status, check, sync, keys, import', usage, run };
