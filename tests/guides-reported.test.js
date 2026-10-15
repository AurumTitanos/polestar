'use strict';
// Player-reported guide fixes, pinned so a route refresh (re-applying a new
// simulator route to the hand-written guides) cannot silently undo them.
// Each case names the report it protects and checks behaviour on the guide
// compiled with the real reference data: goal order and where the arrow
// leads, not the guide's wording. The timed quest items have their own lint
// rule (tests/lint-timed.test.js); the Fargodeep Mine and Blackfathom Deeps
// mouths are in tests/guides-caves.test.js.
//
// Needs data/forever (node tools/polestar.js data build); skips without it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { needs } = require('./helpers/data');
const { compileSources, OFFICIAL_DIR } = require('../tools/lib/dsl/project');
const { loadData } = require('../tools/lib/dsl/data');
const { DATA } = require('../tools/lib/paths');

const skip = needs('quests.json', 'npcs.json', 'objects.json', 'map-frames.json');

const DUROTAR = 'forever/horde/orc-troll/01-durotar.guide';
const DUN_MOROGH = 'forever/alliance/dwarf-gnome/01-dun-morogh.guide';
const TELDRASSIL = 'forever/alliance/nightelf/01-teldrassil.guide';
const ELWYNN = 'forever/alliance/human/01-elwynn-forest.guide';
const MULGORE = 'forever/horde/tauren/01-mulgore.guide';
const TIRISFAL = 'forever/horde/undead/01-tirisfal-glades.guide';

let data;
const memo = new Map();
// The guide's goals in order, as { step, goal }.
function goals(guide) {
	if (!memo.has(guide)) {
		data = data || loadData(DATA);
		const file = path.join(OFFICIAL_DIR, guide);
		const { guides } = compileSources([{ file, text: fs.readFileSync(file, 'utf8') }], data);
		assert.equal(guides.length, 1, `${guide} compiles`);
		memo.set(guide, guides[0].steps.flatMap((step) => step.goals.map((goal) => ({ step, goal }))));
	}
	return memo.get(guide);
}

// Index of the first goal matching, asserted present.
function at(list, what, pred) {
	const i = list.findIndex(({ goal }) => pred(goal));
	assert.ok(i >= 0, `${what} is in the guide`);
	return i;
}
const is = (t, quest) => (g) => g.t === t && g.quest === quest;
const located = ({ goal }) => goal.map != null && goal.x != null;
// Goals every character of the guide does (no `only` on the goal or its step).
const everyone = ({ step, goal }) => !step.only && !goal.only;
// Goals a character of this class does (an `only` naming classes on the goal or its step must list it).
const forClass = (cls) => ({ step, goal }) => [step.only, goal.only].every((o) => !o || !o.classes || o.classes.includes(cls));

// Yards between two compiled points on one map (Era frame).
function yards(a, b) {
	const f = data.eraFrame(a.map);
	assert.ok(f && a.map === b.map, `points on one map with an Era frame (${a.map}, ${b.map})`);
	return Math.hypot(((f.right - f.left) * (a.x - b.x)) / 100, ((f.bottom - f.top) * (a.y - b.y)) / 100);
}

// --- Durotar (Tom): Sting of the Scorpid and the cactus apples come along to Sarkoth.

test(`${DUROTAR}: Tom's report: Cutting Teeth is turned in and Sting of the Scorpid and Galgar's Cactus Apple Surprise accepted before Sarkoth`, { skip }, () => {
	const list = goals(DUROTAR);
	const sarkoth = at(list, "Sarkoth's Mangled Claw", (g) => g.t === 'collect' && g.quest === 790);
	assert.ok(at(list, 'turnin 788 (Cutting Teeth)', is('turnin', 788)) < sarkoth, 'Cutting Teeth is handed in before Sarkoth');
	assert.ok(at(list, 'accept 789 (Sting of the Scorpid)', is('accept', 789)) < sarkoth, 'Sting of the Scorpid is taken before Sarkoth');
	assert.ok(at(list, "accept 4402 (Galgar's Cactus Apple Surprise)", is('accept', 4402)) < sarkoth, 'the cactus apples are taken before Sarkoth');
	// Their objectives are done on Sarkoth's slope, before going back to the Den.
	const back = at(list, 'turnin 804 (Sarkoth)', is('turnin', 804));
	for (const q of [789, 4402]) assert.ok(at(list, `the objective of ${q}`, (g) => g.t === 'collect' && g.quest === q) < back, `${q}'s objective is done before the Den`);
});

// --- Caves (Tom): the arrow leads to a cave's mouth before anyone inside it.

// The Den: Kzan Thornslash stands at the back of the cave, behind Gornek just inside it.
test(`${DUROTAR}: Tom's report: the arrow's last waypoint before Kzan Thornslash is the Den's mouth`, { skip }, () => {
	const list = goals(DUROTAR);
	const kzan = at(list, 'turnin 97279 (Wayward Weapons)', is('turnin', 97279));
	const last = list.slice(0, kzan).reverse().find(({ goal }) => goal.t === 'goto');
	assert.ok(last, 'a goto comes before Kzan');
	const { map, x, y } = last.goal;
	assert.deepEqual({ map, x, y }, { map: 1411, x: 42.4, y: 68.6 });
	// Whatever the arrow points at between the mouth and Kzan is inside the Den's mouth, not across the hill.
	const between = list.slice(list.indexOf(last) + 1, kzan).filter(located).filter(everyone);
	for (const { goal } of between) assert.ok(yards(goal, last.goal) < 40, `${goal.t} ${goal.quest || ''} lies by the mouth`);
});

const CAVES = [
	// Thazz'ril's Pick and Yarrog Baneshadow: "Go in the cave (45 56)".
	{ cave: 'the Burning Blade Coven (the pick)', guide: DUROTAR, target: (g) => g.t === 'collect' && g.item === 16332, mouth: { map: 1411, x: 45, y: 56 } },
	{ cave: 'the Burning Blade Coven (Yarrog)', guide: DUROTAR, target: (g) => g.t === 'collect' && g.item === 4859, mouth: { map: 1411, x: 45, y: 56 } },
	{ cave: 'Skull Rock', guide: DUROTAR, target: (g) => g.t === 'collect' && g.item === 4871, mouth: { map: 1411, x: 55, y: 10 } },
	// The troll cave's mouth as marked in game (thmastin, PR #16); Wowhead's comments put it at 26,79.
	{ cave: 'the Coldridge troll cave', guide: DUN_MOROGH, target: (g) => g.t === 'collect' && g.item === 2004, mouth: { map: 1426, x: 26.93, y: 80.03 } },
	{ cave: 'the Jasperlode Mine', guide: ELWYNN, target: (g) => g.t === 'complete' && g.quest === 76, mouth: { map: 1429, x: 61.6, y: 54.1 } },
	{ cave: 'Shadowthread Cave', guide: TELDRASSIL, target: (g) => g.t === 'collect' && g.item === 5167, mouth: { map: 1438, x: 57, y: 32 } },
	{ cave: 'Fel Rock', guide: TELDRASSIL, target: (g) => g.t === 'collect' && g.item === 5221, mouth: { map: 1438, x: 54, y: 52 } },
	// The Webbed Victims are freed inside the cave.
	{ cave: "Night Web's Hollow", guide: TIRISFAL, target: (g) => g.t === 'goto' && g.x === 24.8 && g.y === 59.6, mouth: { map: 1420, x: 26, y: 60 } },
];

for (const c of CAVES) {
	test(`${c.guide}: Tom's report: the arrow reaches ${c.cave} through its mouth at ${c.mouth.x},${c.mouth.y}`, { skip }, () => {
		const list = goals(c.guide);
		const i = at(list, c.cave, c.target);
		const before = list.slice(0, i).reverse().find(located);
		assert.ok(before, 'a located goal comes before the target');
		const { t, map, x, y } = before.goal;
		assert.deepEqual({ t, map, x, y }, { t: 'goto', ...c.mouth }, `the waypoint before "${list[i].step.title}" is the mouth`);
	});
}

// --- The starting glens: one delivery quest no longer sends you off and back.

test(`${TELDRASSIL}: Dolanaar Delivery is taken from Porthannius after the Shadowglen quests, on the way out to Dolanaar`, { skip }, () => {
	const list = goals(TELDRASSIL);
	const take = at(list, 'accept 2159 (Dolanaar Delivery)', is('accept', 2159));
	// Shadowglen's last turn-ins: Crown of the Earth at Tenaron, Iverron's Antidote.
	for (const q of [921, 3522, 917, 457, 456]) assert.ok(at(list, `turnin ${q}`, is('turnin', q)) < take, `turnin ${q} comes before the delivery`);
	const keldamyr = list[at(list, 'turnin 2159', is('turnin', 2159))].goal;
	const tenaron = list[at(list, 'turnin 921', is('turnin', 921))].goal;
	const porthannius = list[take].goal;
	// Porthannius stands between the tree and Dolanaar, and the next stop is Dolanaar.
	assert.ok(yards(porthannius, keldamyr) < yards(tenaron, keldamyr), 'Porthannius is on the way down to Dolanaar');
	const next = list.slice(take + 1).filter(located).find(everyone);
	assert.ok(yards(next.goal, keldamyr) < yards(next.goal, tenaron), `the next stop (${next.goal.t} ${next.goal.quest}) is in Dolanaar`);
});

test(`${DUN_MOROGH}: Supplies to Tannok is taken from Hands Springsprocket at the tunnel, leaving Coldridge Valley`, { skip }, () => {
	const list = goals(DUN_MOROGH);
	const take = at(list, 'accept 2160 (Supplies to Tannok)', is('accept', 2160));
	// After the valley's last quests (Bring Back the Mug at Nori, the journal at Grelin).
	for (const q of [3365, 218, 170, 183]) assert.ok(at(list, `turnin ${q}`, is('turnin', q)) < take, `turnin ${q} comes before Supplies to Tannok`);
	// Beside Mountaineer Thalos at the tunnel's mouth.
	const thalos = list[at(list, 'turnin 282 (Mountaineer Thalos)', is('turnin', 282))].goal;
	assert.ok(yards(list[take].goal, thalos) < 40, 'Hands Springsprocket is taken at the tunnel, beside Thalos');
	const before = list.slice(0, take).reverse().filter(located).find(everyone);
	assert.ok(yards(before.goal, thalos) < 40, 'the stop before it is at the tunnel too');
});

test(`${MULGORE}: A Task Unfinished at Antur Fallow starts the cougar hunt, with no walk back into the camp`, { skip }, () => {
	const list = goals(MULGORE);
	const take = at(list, 'accept 1656 (A Task Unfinished)', is('accept', 1656));
	const hunt = at(list, 'the cougar hunt (750)', (g) => g.quest === 750 && g.t !== 'accept' && g.t !== 'turnin');
	assert.ok(take < hunt, 'Antur comes before the hunt');
	assert.equal(list[take].step, list[hunt].step, "Antur's quest opens the hunt's step: the hunt starts at his end of the camp");
	assert.deepEqual(list.slice(take + 1, hunt).filter(located).filter(everyone).map(({ goal }) => `${goal.t} ${goal.quest}`), [], 'the hunt follows Antur straight away');
	assert.ok(hunt < at(list, 'turnin 750', is('turnin', 750)), 'the hunt ends at Grull');
});

// --- Bandarion Keep (Mike_, 0.2.3): Hilda the Breaker and Ephram Barbaro offer their quests to Paladins only.

test(`${TIRISFAL}: Mike_'s report: only Paladins are sent to Hilda the Breaker and Ephram Barbaro at Bandarion Keep`, { skip }, () => {
	const list = goals(TIRISFAL);
	const keep = [246389, 259190]; // Hilda the Breaker, Ephram Barbaro
	const mage = list.filter(forClass('MAGE'));
	assert.deepEqual(mage.filter(({ goal }) => keep.includes(goal.npc)).map(({ goal }) => `${goal.t} ${goal.quest} (${goal.npcName})`), [], 'a Mage meets neither giver');
	assert.deepEqual(mage.filter(({ goal }) => goal.quest === 99152 || goal.quest === 99153).map(({ goal }) => `${goal.t} ${goal.quest}`), [], 'nor any goal of their quests');
	// The Shadowvale elixir bottles stay for everyone (at asserts the goal is there).
	at(mage, 'collect 268801 (Bottle of Whispering Elixir)', (g) => g.t === 'collect' && g.quest === 95314);
	const paladin = list.filter(forClass('PALADIN'));
	for (const q of [99152, 99153]) {
		const take = at(paladin, `accept ${q} for a Paladin`, is('accept', q));
		assert.ok(keep.includes(paladin[take].goal.npc), `a Paladin takes ${q} at the keep`);
		assert.ok(take < at(paladin, `turnin ${q} for a Paladin`, is('turnin', q)));
	}
});

// --- Coldridge Valley (thmastin, PR #16): the valley is never walked back to.

test(`${DUN_MOROGH}: thmastin's report: Grik'nir comes after Anvilmar, and the journal and Nori's mug are handed in on one camp visit`, { skip }, () => {
	const list = goals(DUN_MOROGH);
	const griknir = at(list, "Grelin Whitebeard's Journal (Grik'nir)", (g) => g.t === 'collect' && g.item === 2004);
	assert.ok(at(list, 'turnin 3364 (Scalding Mornbrew Delivery, Anvilmar)', is('turnin', 3364)) < griknir, 'Anvilmar comes before Grik\'nir');
	const journal = at(list, 'turnin 218 (The Stolen Journal)', is('turnin', 218));
	const mug = at(list, 'turnin 3365 (Bring Back the Mug)', is('turnin', 3365));
	assert.ok(griknir < journal && griknir < mug, 'both are handed in after Grik\'nir');
	assert.equal(list[journal].step, list[mug].step, 'the journal and the mug are handed in on one visit to Grelin\'s camp');
	// Grund and Gozwin is done in the valley, before the troll cave, not on a return after Rumbleshot.
	assert.ok(at(list, 'turnin 97277 (Grund and Gozwin)', is('turnin', 97277)) < griknir, 'Grund and Gozwin is handed in before the troll cave');
});

test(`${DUN_MOROGH}: thmastin's report: The Adventurer is taken from Thalos at the tunnel and turned in at Eric before The Great Outdoors`, { skip }, () => {
	const list = goals(DUN_MOROGH);
	const take = at(list, 'accept 96628 (The Adventurer)', is('accept', 96628));
	const thalos = at(list, 'turnin 282 (Senir\'s Observations, Thalos)', is('turnin', 282));
	assert.equal(list[take].step, list[thalos].step, 'taken at the tunnel, on the way out of the valley');
	const give = at(list, 'turnin 96628 (The Adventurer)', is('turnin', 96628));
	assert.equal(list[give].goal.npcName, 'Eric Brighthammer', 'turned in at Eric');
	assert.ok(give < at(list, 'accept 96608 (The Great Outdoors)', is('accept', 96608)), 'before The Great Outdoors, which it leads to');
});
