'use strict';
// A Discord gateway connection on Node's own WebSocket: identify, heartbeat,
// resume after a drop, start over when the session is gone. Dispatches go to
// onDispatch(type, data); READY and RESUMED come through it too.
//
// https://discord.com/developers/docs/events/gateway

const OP = { DISPATCH: 0, HEARTBEAT: 1, IDENTIFY: 2, RESUME: 6, RECONNECT: 7, INVALID_SESSION: 9, HELLO: 10, ACK: 11 };

// GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT (privileged: switch it on in the
// Developer Portal, Bot, "Message Content Intent").
const INTENTS = (1 << 0) | (1 << 9) | (1 << 15);

// Close codes that no reconnect fixes.
const FATAL = {
	4004: 'the bot token is wrong (DISCORD_TOKEN)',
	4010: 'invalid shard',
	4011: 'sharding required',
	4012: 'invalid API version',
	4013: 'invalid intents',
	4014: 'the Message Content intent is off: turn it on in the Developer Portal, Bot, Privileged Gateway Intents',
};

function createGateway({ token, url, onDispatch, onFatal, log = console, WebSocketImpl = WebSocket }) {
	let ws = null;
	let seq = null;
	let session = null;
	let resumeUrl = null;
	let beat = null;
	let acked = true;
	let stopped = false;
	let retries = 0;

	function send(op, d) {
		if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op, d }));
	}

	function stopBeat() {
		clearTimeout(beat);
		clearInterval(beat);
		beat = null;
	}

	function startBeat(interval) {
		stopBeat();
		acked = true;
		const tick = () => {
			if (!acked) {
				log.warn('gateway: no heartbeat ack, reconnecting');
				ws.close(4000, 'zombie');
				return;
			}
			acked = false;
			send(OP.HEARTBEAT, seq);
		};
		beat = setTimeout(() => {
			tick();
			beat = setInterval(tick, interval);
		}, Math.floor(interval * Math.random()));
	}

	function identify() {
		send(OP.IDENTIFY, {
			token,
			intents: INTENTS,
			properties: { os: process.platform, browser: 'polestar-bot', device: 'polestar-bot' },
		});
	}

	function connect(resume) {
		const base = resume && resumeUrl ? resumeUrl : url;
		ws = new WebSocketImpl(`${base}/?v=10&encoding=json`);
		const socket = ws;
		socket.addEventListener('message', (ev) => {
			let msg;
			try {
				msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
			} catch {
				return;
			}
			if (msg.s != null) seq = msg.s;
			switch (msg.op) {
				case OP.HELLO:
					startBeat(msg.d.heartbeat_interval);
					if (resume && session) send(OP.RESUME, { token, session_id: session, seq });
					else identify();
					break;
				case OP.ACK:
					acked = true;
					break;
				case OP.HEARTBEAT:
					send(OP.HEARTBEAT, seq);
					break;
				case OP.RECONNECT:
					socket.close(4000, 'reconnect requested');
					break;
				case OP.INVALID_SESSION:
					if (!msg.d) {
						session = null;
						seq = null;
					}
					setTimeout(() => (msg.d ? socket.close(4000, 'invalid session') : identify()), 1000 + Math.random() * 4000);
					break;
				case OP.DISPATCH:
					if (msg.t === 'READY') {
						session = msg.d.session_id;
						resumeUrl = msg.d.resume_gateway_url;
						retries = 0;
					}
					if (msg.t === 'RESUMED') retries = 0;
					try {
						onDispatch(msg.t, msg.d);
					} catch (err) {
						log.error(`gateway: ${msg.t} handler failed:`, err);
					}
					break;
			}
		});
		socket.addEventListener('close', (ev) => {
			stopBeat();
			if (socket !== ws || stopped) return;
			if (FATAL[ev.code]) {
				onFatal(new Error(`Discord closed the connection (${ev.code}): ${FATAL[ev.code]}`));
				return;
			}
			const delay = Math.min(60000, 1000 * 2 ** retries++);
			log.warn(`gateway: closed (${ev.code}${ev.reason ? ' ' + ev.reason : ''}), reconnecting in ${delay / 1000}s`);
			setTimeout(() => connect(Boolean(session)), delay);
		});
		socket.addEventListener('error', () => {});
	}

	return {
		start: () => connect(false),
		stop() {
			stopped = true;
			stopBeat();
			if (ws) ws.close(1000, 'shutdown');
		},
	};
}

module.exports = { createGateway, INTENTS };
