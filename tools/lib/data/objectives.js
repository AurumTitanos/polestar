'use strict';
// Objective counts from quest objective text, taken only from patterns that
// state the count outright; anything else stays null rather than guessed:
// - a number (digits or spelled out up to twenty) directly before the name or
//   its plural, optionally through "<word> of" ("7 pieces of Plainstrider
//   Meat") or "the";
// - the same with a trailing part of the name ("Kill 7 Tidehunters" for
//   Murloc Tidehunter) when no other objective of the quest shares that part;
// - "a"/"an" before the exact singular name -> 1, and for items also "the"
//   ("Retrieve the Warchief's Orders").

const WORDS = {
	one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
	eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
	eighteen: 18, nineteen: 19, twenty: 20,
};
const MAX_COUNT = 250;
const NUMBER = `\\d+|${Object.keys(WORDS).join('|')}`;

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function plurals(word) {
	const lower = word.toLowerCase();
	const out = [`${word}s`];
	if (/(s|x|z|ch|sh)$/.test(lower)) out.push(`${word}es`);
	if (/[^aeiou]y$/.test(lower)) out.push(`${word.slice(0, -1)}ies`);
	if (/fe$/.test(lower)) out.push(`${word.slice(0, -2)}ves`);
	else if (/f$/.test(lower)) out.push(`${word.slice(0, -1)}ves`);
	if (/man$/.test(lower)) out.push(`${word.slice(0, -3)}men`);
	if (lower === 'tooth') out.push(`${word[0]}eeth`);
	if (lower === 'foot') out.push(`${word[0]}eet`);
	if (lower === 'mouse') out.push(`${word[0]}ice`);
	return out;
}

// The name plus plausible plurals: of its last word, and for "X of Y" names
// of the word before "of" ("Idols of Strife").
function nameForms(name) {
	const forms = new Set([name]);
	const last = /^(.*?)([A-Za-z']+)$/.exec(name);
	if (last) for (const p of plurals(last[2])) forms.add(last[1] + p);
	const of = /^(.*?)([A-Za-z']+)( of .+)$/.exec(name);
	if (of) for (const p of plurals(of[2])) forms.add(of[1] + p + of[3]);
	// Longest first so "Kobold Workers" wins over "Kobold Worker".
	return [...forms].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

function formsPattern(name) {
	return nameForms(name).map(escapeRe).join('|');
}

function numericCount(text, forms) {
	const re = new RegExp(`(?<![A-Za-z0-9])(${NUMBER})\\s+(?:(?:[A-Za-z]+\\s+)?of\\s+)?(?:the\\s+)?(?:${forms})(?![A-Za-z])`, 'i');
	const m = re.exec(text);
	if (!m) return null;
	const raw = m[1].toLowerCase();
	const count = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw];
	return count >= 1 && count <= MAX_COUNT ? { count, pos: m.index } : null;
}

// Trailing parts of a multi-word name that no other objective name ends with.
function suffixAliases(name, others) {
	const words = name.split(/\s+/);
	const out = [];
	const lowerOthers = others.filter((o) => o && o !== name).map((o) => o.toLowerCase());
	for (let k = 1; k < words.length; k++) {
		const suffix = words.slice(k).join(' ');
		if (suffix.length < 4 || /^of\b/i.test(suffix)) continue;
		const s = suffix.toLowerCase();
		if (lowerOthers.some((o) => o === s || o.endsWith(` ${s}`))) continue;
		out.push(suffix);
	}
	return out;
}

// -> { count: number|null, pos: index of first mention or -1 }
// options: { type: "kill"|"item"|..., others: [names of the quest's other objectives] }
function parseCount(text, name, { type, others = [] } = {}) {
	if (!text || !name) return { count: null, pos: -1 };
	const forms = formsPattern(name);
	const mention = new RegExp(`(?<![A-Za-z])(?:${forms})(?![A-Za-z])`, 'i').exec(text);
	let pos = mention ? mention.index : -1;
	let hit = numericCount(text, forms);
	if (!hit) {
		for (const alias of suffixAliases(name, others)) {
			hit = numericCount(text, formsPattern(alias));
			if (hit) break;
		}
	}
	if (!hit) {
		const articles = type === 'item' ? 'an?|the' : 'an?';
		const re = new RegExp(`(?<![A-Za-z])(?:${articles})\\s+(?:[A-Za-z]+\\s+of\\s+)?${escapeRe(name)}(?![A-Za-z'])`, 'i');
		const m = re.exec(text);
		if (m) hit = { count: 1, pos: m.index };
	}
	if (!hit) return { count: null, pos };
	if (pos < 0) pos = hit.pos;
	return { count: hit.count, pos };
}

// Recorded objective text: "Kobold Vermin slain: 3/10" -> { name, slain, cur, max }
function parseProgressText(text) {
	if (typeof text !== 'string') return null;
	const m = /^\s*(.*?)\s*:\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
	if (!m) return null;
	let name = m[1];
	let slain = false;
	const s = /^(.*?)\s+(slain|killed)$/i.exec(name);
	if (s) {
		name = s[1];
		slain = true;
	}
	return { name, slain, cur: Number(m[2]), max: Number(m[3]) };
}

module.exports = { parseCount, nameForms, parseProgressText };
