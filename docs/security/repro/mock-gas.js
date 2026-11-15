// ローカル専用: src/sync/Code.gs を無改変で読み込み、Google のサービスをメモリ上の偽物に差し替えて
// http://127.0.0.1:8787/exec で動かす。本物の Google / スプレッドシートには一切接続しない。
const fs = require('fs'), vm = require('vm'), http = require('http');
const CODE = fs.readFileSync(process.argv[2], 'utf8');
let ctx, sheets, props, cache;

function colIdx(a) { let n = 0; for (const ch of a) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
function evalCell(v, depth = 0) {
  // Sheets の「= で始まる文字列は数式」という挙動の簡易エミュレーション(=タブ名!A1 の参照だけ評価)
  if (typeof v !== 'string' || v[0] !== '=' || depth > 5) return v;
  const m = /^=([^!]+)!([A-Z]+)(\d+)$/.exec(v);
  if (!m || !sheets[m[1]]) return '#ERROR!(emulated)';
  const row = sheets[m[1]][Number(m[3]) - 1] || [];
  return evalCell(row[colIdx(m[2])] ?? '', depth + 1);
}
function makeSheet(name) {
  const data = sheets[name];
  const range = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => evalCell((data[r - 1 + i] || [])[c - 1 + j] ?? ''))),
    setValues: (vals) => vals.forEach((rowv, i) => { const row = (data[r - 1 + i] = data[r - 1 + i] || []); rowv.forEach((v, j) => { row[c - 1 + j] = v; }); }),
  });
  return {
    getRange: range,
    getLastRow: () => data.length,
    getDataRange: () => range(1, 1, Math.max(data.length, 1), Math.max(1, ...data.map((r) => r.length))),
  };
}
function reset(secret) {
  sheets = {}; props = {}; cache = {};
  if (secret) props.SECRET = secret;
  const ss = {
    getSheetByName: (n) => (Object.prototype.hasOwnProperty.call(sheets, n) ? makeSheet(n) : null),
    insertSheet: (n) => { sheets[n] = []; return makeSheet(n); },
  };
  ctx = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => s }) },
    Utilities: { formatDate: (d) => d.toISOString() },
    Logger: { log() {} },
  });
  vm.runInContext(CODE, ctx);
}
reset();
let requests = 0;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    try {
      if (url.pathname === '/__reset') { reset(url.searchParams.get('secret')); return res.end('{"reset":true}'); }
      if (url.pathname === '/__seed') { const s = JSON.parse(body); sheets[s.name] = s.rows; return res.end('{"seeded":true}'); }
      if (url.pathname === '/__dump') return res.end(JSON.stringify({ requests, sheets }));
      requests++;
      const e = { parameter: Object.fromEntries(url.searchParams), postData: { contents: body } };
      res.end(req.method === 'POST' ? ctx.doPost(e) : ctx.doGet(e));
    } catch (err) { res.statusCode = 500; res.end(JSON.stringify({ harnessError: String(err) })); }
  });
}).listen(8787, '127.0.0.1', () => console.log('mock GAS on http://127.0.0.1:8787/exec'));
