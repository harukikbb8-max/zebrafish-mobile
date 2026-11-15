const { chromium, devices } = require('playwright');
const dump = () => fetch('http://127.0.0.1:8787/__dump').then((r) => r.json());
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ ...devices['iPhone 14'] })).newPage();
  await p.goto('http://localhost:8081/', { waitUntil: 'load', timeout: 90000 });
  await p.getByPlaceholder('https://script.google.com/.../exec').fill('http://127.0.0.1:8787/exec', { timeout: 60000 });
  await p.getByText('接続して始める', { exact: true }).click();
  await p.waitForTimeout(3000);
  console.log('初回設定の画面が消えた:', !(await p.getByText('はじめての設定').isVisible().catch(() => false)));
  await p.getByText('餌をあげた', { exact: true }).first().click();
  console.log('ユーザー操作は「餌をあげた」を 1 回押しただけ。以後は何も操作しない。');
  const t0 = Date.now();
  for (let i = 0; i < 7; i++) {
    await p.waitForTimeout(15000);
    const d = await dump();
    const logs = (d.sheets.activity_logs || []).slice(1);
    const sync = logs.filter((r) => r[2] === '同期').length;
    console.log(`${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}秒後: activity_logs ${logs.length} 行(うち同期ログ ${sync} 行) / サーバーへのリクエスト累計 ${d.requests}`);
  }
  await b.close();
})();
