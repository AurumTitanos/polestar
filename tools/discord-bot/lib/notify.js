'use strict';
// GitHub back to Discord, run by the Actions: an issue filed from a #bugs
// post closed or reopened, and a release that ships the fixes. The player
// hears it in their own thread, which gets the matching status tag (Fixed,
// Won't fix, Duplicate, Tracked again) and is locked while the issue is
// closed. Every such message pings only the reporter. A prerelease (a
// release candidate) tells no thread: it pings the tester role once in the
// testers channel instead.

const I = require('./issue');
const { statusTags, withStatus } = require('./discord');

const MAX_REASON = 1200;

function issueLink(repo, n) {
	return `[${repo}#${n}](<https://github.com/${repo}/issues/${n}>)`;
}

function clip(text, n) {
	const t = String(text).trim();
	return t.length > n ? t.slice(0, n - 3).trimEnd() + '...' : t;
}

const quote = (text) => text.split('\n').map((l) => '> ' + l).join('\n');

// The last thing a maintainer said on the issue (not the bot's copies of
// Discord follow-ups), as the reason for closing it.
function maintainerNote(comments) {
	const team = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
	for (let i = comments.length - 1; i >= 0; i--) {
		const c = comments[i];
		if (!team.has(c.author_association) || !c.body || c.body.includes(I.FOLLOWUP_MARK)) continue;
		if (c.user && c.user.type === 'Bot') continue;
		return c.body.trim();
	}
	return null;
}

function duplicateOf(comments) {
	for (let i = comments.length - 1; i >= 0; i--) {
		const m = String(comments[i].body || '').match(/duplicate of #(\d+)/i);
		if (m) return Number(m[1]);
	}
	return null;
}

// The first line of a "not planned" close, by the resolution label /close
// sets (lib/commands.js); closed on GitHub without one, "won't change".
const NOT_PLANNED = {
	'resolution:no-action': 'No change is needed here.',
	'resolution:cannot-reproduce': 'We couldn\'t reproduce this one.',
	'resolution:not-resolved': 'We\'re closing this one without a fix for now.',
};

// The message and status for an issue's close or reopen.
function issueMessage({ repo, issue, action, owner, comments }) {
	const ping = owner ? `<@${owner}> ` : '';
	const link = issueLink(repo, issue.number);
	if (action === 'reopened') {
		return { role: 'tracked', locked: false, content: `We've reopened this and are looking at it again. (${link})` };
	}
	if (issue.state_reason === 'duplicate') {
		const of = duplicateOf(comments);
		const where = of ? `we're tracking it in ${issueLink(repo, of)}` : "we're tracking it in another issue";
		return { role: 'duplicate', locked: true, content: `${ping}This was already reported, so ${where}. Thanks for the report! (${link})` };
	}
	if (issue.state_reason === 'not_planned') {
		const note = maintainerNote(comments);
		const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
		const lead = labels.map((l) => NOT_PLANNED[l]).find(Boolean) || 'We\'ve decided not to change this one.';
		let content = `${ping}${lead}`;
		if (note) content += '\n' + quote(clip(note, MAX_REASON));
		content += `\nThanks for the report! (${link})`;
		return { role: 'wontfix', locked: true, content };
	}
	return { role: 'fixed', locked: true, content: `${ping}This is fixed and will ship in the next Polestar update. Thanks for the report! (${link})` };
}

function releaseMessage({ repo, issue, release, owner }) {
	const name = release.name || release.tag_name;
	const ping = owner ? `<@${owner}> ` : '';
	return `${ping}The fix is out in **${name}**: update Polestar to get it. ([release notes](<${release.html_url}>), ${issueLink(repo, issue.number)})`;
}

// The thread an issue was filed from, or null (no marker, deleted, or not
// in the forum named by forumId when one is given).
async function threadOf(discord, issue, forumId, log) {
	const mk = I.readMarker(issue.body);
	if (!mk) return null;
	try {
		const thread = await discord.getChannel(mk.thread);
		if (forumId && thread.parent_id !== forumId) {
			log.warn(`#${issue.number}: thread ${mk.thread} is not in the #bugs forum, skipped`);
			return null;
		}
		return thread;
	} catch (err) {
		if (err.status === 404 || err.status === 403) {
			log.warn(`#${issue.number}: thread ${mk.thread} is gone`);
			return null;
		}
		throw err;
	}
}

// Posts in a thread, opening it first when Discord archived it.
async function postIn(discord, thread, content, users) {
	if (thread.thread_metadata && thread.thread_metadata.archived) await discord.editThread(thread.id, { archived: false });
	await discord.send(thread.id, content, users);
}

async function onIssue({ discord, github, event, forumId, log = console }) {
	const issue = event.issue;
	const action = event.action;
	if (action !== 'closed' && action !== 'reopened') return false;
	const thread = await threadOf(discord, issue, forumId, log);
	if (!thread) return false;
	const comments = action === 'closed' ? await github.comments(issue.number) : [];
	const msg = issueMessage({ repo: github.repo, issue, action, owner: thread.owner_id, comments });
	await postIn(discord, thread, msg.content, thread.owner_id ? [thread.owner_id] : []);
	const forum = await discord.getChannel(thread.parent_id);
	await discord.editThread(thread.id, { applied_tags: withStatus(thread.applied_tags, statusTags(forum), msg.role), locked: msg.locked });
	log.info(`#${issue.number} ${action} (${issue.state_reason || 'reopened'}): told thread ${thread.id}`);
	return true;
}

// A prerelease: GitHub's prerelease flag, or a tag with a prerelease part
// (v0.3.0-rc.1, v0.2.5-test.1).
function isPrerelease(release) {
	return Boolean(release.prerelease) || /^v?\d+\.\d+\.\d+-/.test(release.tag_name || '');
}

// The commit that closed an issue, or null when it was closed by hand: the
// last close's commit (a push saying "Fixes #N"), else the merge commit of
// this repository's pull request merged as it closed (a minute apart at
// most).
async function closingCommit(github, n) {
	const events = await github.timeline(n);
	const close = events.filter((e) => e.event === 'closed').at(-1);
	if (!close) return null;
	if (close.commit_id) return close.commit_id;
	const at = Date.parse(close.created_at);
	const pr = events
		.map((e) => e.event === 'cross-referenced' && e.source && e.source.issue)
		.find((src) => src && src.pull_request && src.pull_request.merged_at &&
			String(src.repository_url || '').endsWith(`/repos/${github.repo}`) &&
			Math.abs(Date.parse(src.pull_request.merged_at) - at) <= 60000);
	if (!pr) return null;
	return (await github.pull(pr.number)).merge_commit_sha || null;
}

const isFeature = (r) => /^v?\d+\.\d+\.0$/.test(r.tag_name || '');

// The issues a release ships: filed from Discord, closed as completed before
// it was published, and not told about a release yet (the released:<tag>
// label marks those told). One closed by a commit ships when the release
// holds that commit and the full release before it (prereleases do not
// count) does not: a fix merged into `next` waits for the feature release,
// however many patches go out first, so those are looked for back to the
// last feature release (x.y.0). One closed by hand ships when it closed
// after the full release before was published.
async function shippedBy(github, release) {
	const published = Date.parse(release.published_at || release.created_at);
	const full = (await github.releases())
		.filter((r) => !r.draft && !isPrerelease(r) && r.id !== release.id && Date.parse(r.published_at) < published)
		.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
	const earlier = full[0];
	const feature = full.find(isFeature);
	const from = earlier ? Date.parse(earlier.published_at) : 0;
	const reach = feature ? Date.parse(feature.published_at) : 0;
	const closed = await github.issuesLabelled('discord', { state: 'closed', since: reach ? feature.published_at : undefined, max: 1000 });
	const out = [];
	for (const i of closed) {
		const at = Date.parse(i.closed_at);
		if (i.state_reason !== 'completed' || at <= reach || at > published) continue;
		if (i.labels.some((l) => String(l.name || l).startsWith('released:'))) continue;
		const sha = await closingCommit(github, i.number);
		if (!sha) {
			if (at > from) out.push(i);
		} else if (await github.contains(release.tag_name, sha) && !(earlier && await github.contains(earlier.tag_name, sha))) {
			out.push(i);
		}
	}
	return out;
}

const MAX_MESSAGE = 2000;
const MAX_ENTRY = 300;

// A markdown list's items, each joined onto one line.
function listItems(markdown) {
	const items = [];
	for (const line of markdown.split('\n')) {
		if (line.startsWith('- ')) items.push(line.slice(2).trim());
		else if (line.trim() && items.length) items[items.length - 1] += ' ' + line.trim();
	}
	return items;
}

// A changelog fragment (changes/<slug>.md: front matter naming its section,
// then the entry) as { section, body }, or null when it is not one.
function parseFragment(text) {
	const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(String(text).replace(/\r\n?/g, '\n'));
	if (!m) return null;
	const section = /^section:\s*(\S+)\s*$/m.exec(m[1]);
	return section ? { section: section[1], body: m[2] } : null;
}

// The player entries a tag carries as changelog fragments (changes/*.md
// with section players), in file name order, each on one line.
async function playerEntries(github, ref) {
	const paths = (await github.listDir('changes', ref))
		.filter((f) => f.type === 'file' && f.name.endsWith('.md') && f.name !== 'README.md' && !f.name.startsWith('.'))
		.map((f) => f.path)
		.sort();
	const entries = [];
	for (const p of paths) {
		const frag = parseFragment((await github.readFile(p, ref)) || '');
		if (frag && frag.section === 'players') entries.push(...listItems(frag.body));
	}
	return entries;
}

// The testers' ping for a prerelease: its tag in bold (what marks it told),
// where to report, and as many player entries as fit in one message.
function candidateMessage({ repo, release, role, forumId, entries }) {
	const tag = release.tag_name;
	const bugs = forumId ? `<#${forumId}>` : '#bugs';
	let content = `<@&${role}> **${tag}** is ready to test: please try it and report anything wrong in ${bugs}. ([release](<${release.html_url}>))`;
	if (!entries.length) return content;
	const more = (n) => `\n...and ${n} more in [the changes](<https://github.com/${repo}/tree/${tag}/changes>).`;
	content += '\n\nNew for players:';
	let shown = 0;
	for (const entry of entries) {
		const line = '\n- ' + clip(entry, MAX_ENTRY);
		if (content.length + line.length + more(entries.length).length > MAX_MESSAGE) break;
		content += line;
		shown++;
	}
	return shown < entries.length ? content + more(entries.length - shown) : content;
}

// Pings the tester role about a prerelease, once: a bot message in the
// channel's last 50 carrying the tag in bold means a run already did.
async function announceCandidate({ discord, github, release, forumId, testers, log }) {
	const tag = release.tag_name;
	if (!testers) {
		log.info(`${tag}: a prerelease; DISCORD_TESTERS_CHANNEL_ID or DISCORD_TESTER_ROLE_ID is not set, so no one is told`);
		return false;
	}
	const recent = await discord.getMessages(testers.channel, 50);
	if (recent.some((m) => m.author && m.author.bot && String(m.content || '').includes(`**${tag}**`))) {
		log.info(`${tag}: testers were told already`);
		return false;
	}
	let entries = [];
	try {
		entries = await playerEntries(github, tag);
	} catch (err) {
		log.warn(`${tag}: changes/ not read (${err.message}), the ping goes without them`);
	}
	await discord.send(testers.channel, candidateMessage({ repo: github.repo, release, role: testers.role, forumId, entries }), [], [testers.role]);
	log.info(`${tag}: a prerelease; testers told in ${testers.channel}`);
	return true;
}

async function onRelease({ discord, github, event, forumId, testers = null, log = console }) {
	const release = event.release;
	if (!release || release.draft) return { told: 0, failed: 0 };
	if (isPrerelease(release)) {
		await announceCandidate({ discord, github, release, forumId, testers, log });
		return { told: 0, failed: 0 };
	}
	const label = `released:${release.tag_name}`;
	const issues = await shippedBy(github, release);
	let told = 0;
	let failed = 0;
	for (const issue of issues) {
		try {
			const thread = await threadOf(discord, issue, forumId, log);
			if (thread) {
				await postIn(discord, thread, releaseMessage({ repo: github.repo, issue, release, owner: thread.owner_id }), thread.owner_id ? [thread.owner_id] : []);
				told++;
			}
			await github.ensureLabels([label], I.labelInfo);
			await github.addLabels(issue.number, [label]);
		} catch (err) {
			failed++;
			log.error(`#${issue.number}: ${err.message}`);
		}
	}
	log.info(`${release.tag_name}: ${issues.length} fixed issues from Discord, ${told} threads told, ${failed} failed`);
	return { told, failed };
}

module.exports = { onIssue, onRelease, issueMessage, releaseMessage, candidateMessage, shippedBy, isPrerelease, maintainerNote };
