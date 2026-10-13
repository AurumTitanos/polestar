'use strict';
// The location of `sethome`, `hearth`, `fly` and `getfp` against the places
// the game can report, matched the way the addon matches it
// (addon/Polestar/Core/Engine.lua, goalDone), ignoring case:
//   sethome  GetBindLocation() equals it: an inn's bind location
//   hearth   the zone or subzone text equals it on arrival: an inn's area or
//            the zone an inn stands in
//   fly      the zone or subzone text equals it on arrival: a flight point's
//            town, an inn's area or the zone a flight point stands in
//   getfp    a learned flight point's name ("Stormwind, Elwynn") equals it,
//            or its part before the first comma does
// Inns and flight points come from travel.json, zone names from zones.json.
// A kind of place the data has nothing for is not checked.

const DATA = new WeakMap();

// The part of a flight point's name before its first comma, as the addon reads it.
const town = (name) => String(name).split(',')[0];

function zoneOf(data, map) {
	const z = map != null ? data.zone(map) : null;
	return z && z.name ? String(z.name) : null;
}

// verb -> { accepts(lowercased location) -> bool, names (suggestions) } | null
function placesOf(data) {
	if (DATA.has(data)) return DATA.get(data);
	const inns = data.inns();
	const nodes = data.flightNodes();
	const innNames = inns.flatMap((i) => (Array.isArray(i.names) && i.names.length ? i.names : [i.location]).map(String));
	const set = (names) => {
		const list = [...new Set(names.filter(Boolean))].sort();
		const lower = new Set(list.map((n) => n.toLowerCase()));
		return { names: list, accepts: (l) => lower.has(l) };
	};
	const out = {};
	if (inns.length) {
		out.sethome = set(innNames);
		out.hearth = set([...innNames, ...inns.map((i) => zoneOf(data, i.map))]);
	}
	if (nodes.length) {
		out.fly = set([...nodes.map((n) => town(n.name)), ...innNames, ...nodes.map((n) => zoneOf(data, n.map))]);
		const full = set(nodes.map((n) => String(n.name)));
		const towns = set(nodes.map((n) => town(n.name)));
		out.getfp = { names: towns.names, accepts: (l) => full.accepts(l) || towns.accepts(l) };
	}
	DATA.set(data, out);
	return out;
}

function distance(a, b) {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = row;
	}
	return prev[b.length];
}

// Up to three known names closest to `location`: names holding it (or held
// by it) first, then by spelling distance.
function closest(location, names) {
	const want = location.toLowerCase();
	const scored = [];
	for (const name of names) {
		const n = name.toLowerCase();
		if (n.includes(want) || want.includes(n)) scored.push({ name, score: Math.abs(n.length - want.length) / 100 });
		else {
			const d = distance(want, n);
			if (d <= Math.max(2, Math.floor(want.length / 3))) scored.push({ name, score: d });
		}
	}
	return scored.sort((a, b) => a.score - b.score || (a.name < b.name ? -1 : 1)).slice(0, 3).map((s) => s.name);
}

const WHAT = {
	sethome: ['no inn has that bind location', 'inn'],
	hearth: ['no inn stands there (an inn\'s area or the zone it is in)', 'inn'],
	fly: ['no flight point lands there (its town, an inn\'s area or the zone it is in)', 'flight'],
	getfp: ['no flight point has that name', 'flight'],
};

// -> null when the location can match (or there is no data for the verb),
// else { message, hint } for the warning.
function checkLocation(data, verb, location) {
	const places = data && typeof data.inns === 'function' ? placesOf(data)[verb] : null;
	if (!places || typeof location !== 'string' || places.accepts(location.toLowerCase())) return null;
	const [why, kind] = WHAT[verb];
	const near = closest(location, places.names);
	const lookUp = `\`polestar find --kind ${kind}\` lists every ${kind === 'inn' ? 'inn' : 'flight point'}`;
	return {
		message: `${verb} "${location}": ${why}; the game never reports that name, so the goal never checks off by itself`,
		hint: near.length ? `did you mean ${near.map((n) => `"${n}"`).join(' or ')}? (${lookUp})` : lookUp,
	};
}

module.exports = { checkLocation };
