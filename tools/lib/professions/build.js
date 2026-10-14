'use strict';
// `profession build`: client tables (wago.tools) + data/forever -> data/forever/professions.json.

const fs = require('node:fs');
const path = require('node:path');
const { loadTables } = require('./tables');
const { extractProfessions } = require('./extract');
const { resolveTrainers } = require('./trainers');

const { DATA, SOURCES } = require('../paths');

// Vendor stock limits from pfQuest's vanilla item database (db/items.lua):
// item -> ["V"] = { [npc] = limit }, 0 = unlimited. items.json keeps only the
// vendor ids, so the limits are read from the cached pfQuest clone when it is
// there. -> Map(item -> Map(npc -> limit))
function parseVendorStock(text) {
	const stock = new Map();
	let item = null;
	let inV = false;
	for (const line of text.split('\n')) {
		let m = /^ {2}\[(\d+)\] = \{/.exec(line);
		if (m) {
			item = Number(m[1]);
			inV = false;
			continue;
		}
		if (/^ {4}\["V"\] = \{/.test(line)) {
			inV = true;
			continue;
		}
		if (inV) {
			m = /^ {6}\[(\d+)\] = (\d+),/.exec(line);
			if (m) {
				if (!stock.has(item)) stock.set(item, new Map());
				stock.get(item).set(Number(m[1]), Number(m[2]));
			} else if (/^ {4}\},?/.test(line)) {
				inV = false;
			}
		}
	}
	return stock;
}

function readJson(file) {
	if (!fs.existsSync(file)) throw new Error(`${path.relative(process.cwd(), file)} missing (node tools/polestar.js data build)`);
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function buildProfessions({ dataDir, sourcesDir, pfquestDir, build, offline, outFile, fetchImpl, log = () => {} } = {}) {
	dataDir = dataDir || DATA;
	sourcesDir = sourcesDir || SOURCES;
	pfquestDir = pfquestDir || path.join(sourcesDir, 'pfQuest');
	outFile = outFile || path.join(dataDir, 'professions.json');
	const items = readJson(path.join(dataDir, 'items.json'));
	const npcs = readJson(path.join(dataDir, 'npcs.json'));
	const objects = readJson(path.join(dataDir, 'objects.json'));
	const warnings = [];
	let stock = new Map();
	const stockFile = path.join(pfquestDir, 'db', 'items.lua');
	if (fs.existsSync(stockFile)) stock = parseVendorStock(fs.readFileSync(stockFile, 'utf8'));
	else warnings.push(`${stockFile} missing: vendor stock limits unknown, every vendor counts as unlimited`);
	const loaded = await loadTables({ sourcesDir, build, offline, fetchImpl, log });
	warnings.push(...loaded.warnings);
	const res = extractProfessions(loaded.tables, {
		items,
		npcs,
		objects,
		stock,
		trainers: (id, kind) => resolveTrainers(id, npcs, { kind }),
	});
	warnings.push(...res.warnings);
	// One profession per line, like the other data/forever files.
	const ids = Object.keys(res.professions).sort((a, b) => a - b);
	const text = `{\n${ids.map((id) => `${JSON.stringify(id)}:${JSON.stringify(res.professions[id])}`).join(',\n')}\n}\n`;
	fs.mkdirSync(path.dirname(outFile), { recursive: true });
	fs.writeFileSync(`${outFile}.tmp`, text);
	fs.renameSync(`${outFile}.tmp`, outFile);
	return { outFile, build: loaded.build, report: res.report, warnings, professions: res.professions };
}

module.exports = { buildProfessions, parseVendorStock };
