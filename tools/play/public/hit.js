// Hit-testing the playground's frame (shared by the page and the tests).
// `hits` comes from tools/play/session.js hitMap(): the mouse- and
// wheel-enabled frames in draw order (strata, level, creation), back to
// front, each { id, r: [x, y, w, h], c?: clip [x, y, w, h], m?, w?, d?, x?, k?, n? }
// in screen pixels. The frame that gets the mouse is the front-most one whose
// rect and clip contain the point, as the client picks its mouse focus.
(function (root) {
	'use strict';

	function inside(box, x, y) {
		return x >= box[0] && x < box[0] + box[2] && y >= box[1] && y < box[1] + box[3];
	}

	// want: 'm' (mouse: hover, clicks, drags) or 'w' (the wheel).
	function hitTest(hits, x, y, want) {
		const key = want || 'm';
		for (let i = hits.length - 1; i >= 0; i--) {
			const h = hits[i];
			if (!h[key]) continue;
			if (inside(h.r, x, y) && (!h.c || inside(h.c, x, y))) return h;
		}
		return null;
	}

	// Page coordinates to screen pixels, for an element showing the screen
	// letterboxed (preserveAspectRatio meet) inside `rect`.
	function toScreen(rect, screen, clientX, clientY) {
		const s = Math.min(rect.width / screen.w, rect.height / screen.h);
		const ox = rect.left + (rect.width - screen.w * s) / 2;
		const oy = rect.top + (rect.height - screen.h * s) / 2;
		return { x: (clientX - ox) / s, y: (clientY - oy) / s, scale: s };
	}

	const api = { hitTest, toScreen, inside };
	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	else root.PolestarHit = api;
})(typeof window !== 'undefined' ? window : globalThis);
