'use strict';
// RFC 4180 CSV parsing (quoted fields, doubled quotes, embedded newlines,
// CRLF). wago.tools exports a header row; parseCsv returns one object per
// data row keyed by header name, values as strings.

function parseRows(text) {
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	let i = 0;
	const n = text.length;
	if (text.charCodeAt(0) === 0xfeff) i = 1;
	while (i < n) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				quoted = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"' && field === '') {
			quoted = true;
			i++;
		} else if (c === ',') {
			row.push(field);
			field = '';
			i++;
		} else if (c === '\n' || c === '\r') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
		} else {
			field += c;
			i++;
		}
	}
	if (quoted) throw new Error('CSV: unterminated quoted field');
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

function parseCsv(text) {
	const rows = parseRows(text);
	if (rows.length === 0) return [];
	const header = rows[0];
	const out = [];
	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		if (row.length === 1 && row[0] === '') continue;
		if (row.length !== header.length) {
			throw new Error(`CSV: row ${r + 1} has ${row.length} fields, header has ${header.length}`);
		}
		const obj = {};
		for (let c = 0; c < header.length; c++) obj[header[c]] = row[c];
		out.push(obj);
	}
	return out;
}

module.exports = { parseCsv, parseRows };
