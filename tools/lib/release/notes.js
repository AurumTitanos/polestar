'use strict';
// Release notes from CHANGELOG.md: a version's section in the three forms a
// release is announced in (docs/RELEASING.md, steps 8 to 10). GitHub's notes
// carry the players' and guide authors' entries, CurseForge's the players'
// only, and Discord's are split into posts under Discord's message limit.
// The intro is the maintainer's to write: each form carries a placeholder
// for it (PLACEHOLDER), which must be replaced before publishing.

const REPO = 'https://github.com/fitzforge/polestar';
const CURSEFORGE = 'https://www.curseforge.com/wow/addons/polestar-guides';
const DISCORD = 'https://discord.gg/vMbee6F2e9';
// Discord's message limit for accounts without Nitro.
const DISCORD_LIMIT = 2000;
const PLACEHOLDER = '[[REPLACE';

const HEADINGS = { 'For players': 'players', 'For guide authors': 'authors', 'For contributors': 'contributors' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ITEM = /^\s*(?:[-*+]|\d+\.)\s/;

// Wrapped text with each paragraph and list item on one line; fenced code
// and blank lines kept, runs of blank lines made one.
function joinLines(text) {
	const out = [];
	let cur = null;
	let fence = false;
	const flush = () => {
		if (cur !== null) out.push(cur);
		cur = null;
	};
	for (const line of text.split(/\r?\n/)) {
		if (/^\s*```/.test(line)) {
			flush();
			fence = !fence;
			out.push(line);
		} else if (fence) out.push(line);
		else if (!line.trim()) {
			flush();
			if (out.length && out[out.length - 1] !== '') out.push('');
		} else if (ITEM.test(line) || /^#/.test(line) || cur === null) {
			flush();
			cur = line.replace(/\s+$/, '');
		} else cur += ' ' + line.trim();
	}
	flush();
	while (out.length && out[0] === '') out.shift();
	while (out.length && out[out.length - 1] === '') out.pop();
	return out.join('\n');
}

// A version's section of the changelog: { version, date, players, authors,
// contributors }, each part its text joined (joinLines), '' when absent.
// null when the changelog has no `## <version> (<date>)` heading.
function releaseSection(changelog, version) {
	const lines = changelog.split(/\r?\n/);
	const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const head = new RegExp(`^## ${esc} \\((\\d{4}-\\d{2}-\\d{2})\\)\\s*$`);
	const start = lines.findIndex((l) => head.test(l));
	if (start < 0) return null;
	let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
	if (end < 0) end = lines.length;
	const parts = { players: [], authors: [], contributors: [] };
	let part = null;
	for (const line of lines.slice(start + 1, end)) {
		const m = /^### (.+?)\s*$/.exec(line);
		if (m) part = HEADINGS[m[1]] || null;
		else if (part) parts[part].push(line);
	}
	const out = { version, date: head.exec(lines[start])[1] };
	for (const k of Object.keys(parts)) out[k] = joinLines(parts[k].join('\n'));
	return out;
}

// The names thanked in the entries ("(thanks A, B and C)"), sorted, once each.
function thanked(text) {
	const names = new Set();
	for (const m of text.matchAll(/\(thanks ([^)]+)\)/g)) {
		for (const n of m[1].split(/,\s*|\s+and\s+/)) if (n.trim()) names.add(n.trim());
	}
	return [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : 1));
}

function longDate(iso) {
	const [y, m, d] = iso.split('-').map(Number);
	return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function intro(version) {
	return `${PLACEHOLDER}: the intro, what ${version} brings players, in a bold first sentence and a short paragraph or two.]]`;
}

function thanks(rel) {
	const names = thanked([rel.players, rel.authors, rel.contributors].join('\n'));
	return `Thank you to ${names.length ? `${names.join(', ')} and ` : ''}everyone posting in #bugs.`;
}

function changelogLink(version) {
	return `${REPO}/blob/v${version}/CHANGELOG.md`;
}

function github(rel) {
	const v = rel.version;
	const out = [
		intro(v),
		'',
		`Polestar is still a beta. If something's off, tell us on [Discord](${DISCORD}) or [GitHub Issues](${REPO}/issues).`,
		'',
		'## Install or update',
		'',
		`- **With the CurseForge app:** update [Polestar Guides](${CURSEFORGE}).`,
		`- **By hand:** download \`Polestar-${v}.zip\` below (not "Source code"). Delete every old \`Polestar\` folder from \`World of Warcraft/_classic_beta_/Interface/AddOns/\` (\`_forever_\` from launch), then unzip this one there.`,
		"- **Then quit the game completely and start it again** if the release adds an addon folder: a `/reload` doesn't load new addon folders.",
		'',
		`\`Polestar_Recorder-${v}.zip\` is optional. \`SHA256SUMS\` holds the checksums.`,
	];
	if (rel.players) out.push('', '## For players', '', rel.players);
	if (rel.authors) out.push('', '## For guide authors', '', rel.authors);
	out.push('', '## Thank you', '', thanks(rel), '', `Every change is in the [full changelog](${changelogLink(v)}).`, '');
	return out.join('\n');
}

function curseforge(rel) {
	const v = rel.version;
	const out = [
		`# Polestar ${v}`,
		'',
		intro(v),
		'',
		`Polestar is still a beta. If something's off, tell us on [Discord](${DISCORD}) or [GitHub Issues](${REPO}/issues).`,
		'',
		'## Updating',
		'',
		"Quit the game completely and start it again after updating if the release adds an addon folder: a `/reload` doesn't load new addon folders.",
	];
	if (rel.players) out.push('', '## For players', '', rel.players);
	out.push('', '## Thank you', '', thanks(rel), '', `Every change is in the [full changelog](${changelogLink(v)}).`, '');
	return out.join('\n');
}

// Links that Discord would unfurl into embeds, wrapped in <> so it doesn't.
function discordLinks(text) {
	return text.replace(/\]\((https?:\/\/[^)\s]+)\)/g, '](<$1>)');
}

function chars(s) {
	return [...s].length;
}

// Pieces of an item no longer than limit, cut after a sentence where one
// fits, else at a space.
function splitLong(text, limit) {
	const out = [];
	let rest = text;
	while (chars(rest) > limit) {
		const head = [...rest].slice(0, limit).join('');
		let cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf(': '), head.lastIndexOf('; ')) + 1;
		if (cut <= 0) cut = head.lastIndexOf(' ');
		if (cut <= 0) cut = head.length;
		out.push(rest.slice(0, cut).trimEnd());
		rest = rest.slice(cut).trimStart();
		if (!/^\s*[-*]/.test(rest)) rest = `  ${rest}`;
	}
	out.push(rest);
	return out;
}

// Posts from sections: { heading, blocks }, each post at most limit
// characters; a section that runs on into a new post repeats its heading.
function pack(sections, limit) {
	const posts = [];
	let cur = '';
	for (const { heading, blocks } of sections) {
		let open = false;
		for (const piece of blocks.flatMap((b) => splitLong(b, limit - chars(heading) - 20))) {
			const add = open ? `\n${piece}` : `${cur ? '\n\n' : ''}${heading}\n${piece}`;
			if (cur && chars(cur + add) > limit) {
				posts.push(cur);
				cur = `${heading} (continued)\n${piece}`;
			} else cur += add;
			open = true;
		}
	}
	if (cur) posts.push(cur);
	return posts;
}

// The changelog part's top-level items with their sub-items, as blocks.
function items(text) {
	const blocks = [];
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		if (/^\s+/.test(line) && blocks.length) blocks[blocks.length - 1] += `\n${line}`;
		else blocks.push(line);
	}
	return blocks;
}

function discordPosts(rel) {
	const v = rel.version;
	const tag = `${REPO}/releases/tag/v${v}`;
	const first = [
		`# Polestar ${v} Patch Notes`,
		`-# ${longDate(rel.date)}`,
		'',
		intro(v),
		'',
		'## How to update',
		`- **CurseForge app:** update [Polestar Guides](<${CURSEFORGE}>).`,
		`- **By hand:** download \`Polestar-${v}.zip\` from the [GitHub release](<${tag}>) (not "Source code"). Delete every old \`Polestar\` folder from your AddOns folder, then unzip the new one there.`,
		"- **Restart the game fully** if the release adds an addon folder: a `/reload` won't load it.",
		'',
		'Full patch notes below.',
	].join('\n');
	const body = rel.players ? pack([{ heading: '## For players', blocks: items(discordLinks(rel.players)) }], DISCORD_LIMIT) : [];
	const last = ['## Thank you', thanks(rel), '', `**Download:** <${tag}> or the CurseForge app`, `**Full changelog:** <${changelogLink(v)}>`].join('\n');
	return [first, ...body, last];
}

function discord(rel) {
	const posts = discordPosts(rel);
	const n = posts.length;
	const bar = '====================';
	const out = [
		`Polestar ${rel.version} - Discord announcement, ${n} post${n === 1 ? '' : 's'}`,
		'Post them in order, one message each. Copy only the text between the START and END lines.',
		`Every post is under the ${DISCORD_LIMIT.toLocaleString('en-US')}-character limit for accounts without Nitro.`,
	];
	posts.forEach((p, i) => {
		out.push('', `${bar} POST ${i + 1} of ${n} - START (${chars(p).toLocaleString('en-US')} characters) ${bar}`, p, `${bar} POST ${i + 1} of ${n} - END ${bar}`);
	});
	return out.join('\n') + '\n';
}

module.exports = { PLACEHOLDER, DISCORD_LIMIT, joinLines, releaseSection, thanked, github, curseforge, discord, discordPosts };
