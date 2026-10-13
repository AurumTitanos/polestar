'use strict';
// The prerequisites that actually block a quest, from a quests.json record.
//
// QuestieDB splits prerequisites into preAll (every one turned in) and preAny
// (one of them suffices); pfQuest's `pre` is any-of and, after the QuestieDB
// merge, also lists breadcrumbs (6061 Taming the Beast: pre 6065-6067, its
// three class breadcrumbs). None of these ever block:
// - a breadcrumb: an id in the quest's `breadcrumbs`, or whose `breadcrumbFor`
//   is this quest. It only points the player at the quest, so an any-of group
//   holding one is optional as a whole (788 Cutting Teeth: pre 787 or its
//   breadcrumb 4641); in an all-of group only the breadcrumb itself drops;
// - the quest itself and any quest exclusive with it (either side's `excl`):
//   QuestieDB lists 1516 Call of Earth's race variants 1516/1519/92466 as its
//   own preAny, and 1688 Surena Caledon's `pre` holds 1715, which excludes 1688;
// - the quest's `parent`: a child quest is taken while the parent is in the
//   log, not after turning it in (813 Finding the Antidote, parent 812);
// - a quest nobody can start (in data with no giver, object or item): 786
//   Thwarting Kolkar Aggression's pfQuest `pre` 785 has no giver anywhere.
//
// -> { all: [ids], any: [ids] }: every id in `all` must be turned in, and one
// of `any` when it is non-empty.

function ids(v) {
	return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
}

function startable(q) {
	const s = q.start || {};
	return ids(s.npc).length > 0 || ids(s.object).length > 0 || ids(s.item).length > 0;
}

// quest: the quests.json record; questOf(id) -> another record or null.
function blockingPrereqs(quest, questOf = () => null) {
	if (!quest) return { all: [], any: [] };
	const id = Number(quest.id);
	const crumbs = new Set(ids(quest.breadcrumbs));
	const isCrumb = (p) => {
		if (crumbs.has(p)) return true;
		const pq = questOf(p);
		return !!pq && Number(pq.breadcrumbFor) === id;
	};
	const never = new Set([id, ...ids(quest.excl)]);
	if (Number(quest.parent) > 0) never.add(Number(quest.parent));
	const blocks = (p) => {
		if (never.has(p) || isCrumb(p)) return false;
		const pq = questOf(p);
		if (!pq) return true;
		return !ids(pq.excl).includes(id) && startable(pq);
	};
	const hasSplit = Array.isArray(quest.preAll) || Array.isArray(quest.preAny);
	const all = hasSplit ? ids(quest.preAll).filter(blocks) : [];
	const anyGroup = hasSplit ? ids(quest.preAny) : ids(quest.pre);
	const any = anyGroup.some(isCrumb) ? [] : anyGroup.filter(blocks);
	return { all, any };
}

module.exports = { blockingPrereqs };
