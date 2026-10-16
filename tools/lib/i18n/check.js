'use strict';
// Checks a translation against its English key: the format specifiers the
// code fills (%s, %d, %.1f, %5.2f, %1$s), the client's plural grammar
// (|4singular:plural;) and its colour, texture and link escapes. A missing
// translation is fine (the English shows); a broken one is not.
// Adapted from Ding! by Yendi (@moust4ki), GPL-3.0:
// https://github.com/moust4ki/DingGuideWoWForever

const SPEC = /%(?:(\d+)\$)?[-+ #0]*\d*(?:\.\d+)?([a-zA-Z%])/g;

// -> [{ pos, type }] of a format string's specifiers (%% left out); pos the
// explicit position (%2$s) or null.
function specifiers(s) {
	const out = [];
	let m;
	SPEC.lastIndex = 0;
	while ((m = SPEC.exec(s))) {
		if (m[2] === '%') continue;
		out.push({ pos: m[1] ? Number(m[1]) : null, type: m[2], text: m[0] });
	}
	return out;
}

const VALID = new Set(['s', 'd', 'i', 'f', 'g', 'G', 'e', 'E', 'x', 'X', 'o', 'c', 'q', 'u']);

// Format problems of `translated` against `english`: [] when it fills the
// same values the same way. Positions (%2$s) may reorder them in the client
// (its string.format takes them); all or none must carry one.
function formatProblems(english, translated) {
	const problems = [];
	const en = specifiers(english);
	const tr = specifiers(translated);
	for (const t of tr) if (!VALID.has(t.type)) problems.push(`"${t.text}" is not a format specifier (write %% for a percent sign)`);
	const positional = tr.filter((t) => t.pos !== null);
	if (positional.length && positional.length !== tr.length) problems.push('mixes numbered (%1$s) and plain (%s) specifiers');
	else if (positional.length) {
		const seen = new Set();
		for (const t of tr) {
			const e = en[t.pos - 1];
			if (!e) problems.push(`${t.text}: the English has no value ${t.pos}`);
			else if (e.type !== t.type) problems.push(`${t.text}: value ${t.pos} is ${e.text} in the English`);
			seen.add(t.pos);
		}
		for (let i = 1; i <= en.length; i++) if (!seen.has(i)) problems.push(`value ${i} (${en[i - 1].text}) is never shown`);
	} else {
		const a = en.map((e) => e.type).join(' ');
		const b = tr.map((t) => t.type).join(' ');
		if (a !== b) problems.push(`specifiers ${tr.map((t) => t.text).join(' ') || '(none)'} do not match the English ${en.map((e) => e.text).join(' ') || '(none)'}`);
	}
	// The client's escapes: |4one:many; plural grammar, |cAARRGGBB colour and
	// its |r end, |T texture|t and |H link|h. `||` is a literal bar.
	const count = (s, re) => (s.replace(/\|\|/g, '').match(re) || []).length;
	const escapes = [
		['|4singular:plural;', /\|4[^:;|]*:[^;|]*;/g],
		['|c colour', /\|c[0-9a-fA-F]{8}/g],
		['|r', /\|r/g],
		['|T texture', /\|T/g],
		['|H link', /\|H/g],
		['|n line break', /\|n/g],
	];
	for (const [name, re] of escapes) {
		const a = count(english, re);
		const b = count(translated, re);
		if (a !== b) problems.push(`${name}: ${b} where the English has ${a}`);
	}
	const bare = translated.replace(/\|\|/g, '').match(/\|(?![4cCrRTtHhnA-Za-z])/g);
	if (bare && !/\|(?![4cCrRTtHhnA-Za-z])/.test(english.replace(/\|\|/g, ''))) problems.push('a lone | (the client reads it as an escape; write || for a bar)');
	// A string the code formats (the English has a specifier or %%) cannot
	// hold a lone % : string.format would stop on it.
	if (/%/.test(english) && (en.length || /%%/.test(english)) && /%(?!(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[a-zA-Z%])/.test(translated.replace(/%%/g, ''))) {
		problems.push('a lone % (write %% for a percent sign)');
	}
	return problems;
}

module.exports = { specifiers, formatProblems };
