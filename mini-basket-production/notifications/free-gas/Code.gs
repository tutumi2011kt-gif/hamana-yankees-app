/**
 * 有玉女子ミニバス 当番回答の無料Gmail通知
 *
 * Firebase Sparkのままで使用。Google Apps Script実行ユーザーによる
 * Firestore REST APIのOAuth認証で、最新の回答一覧を読み取り専用で照合します。
 * 15分間隔の差分通知であり、確定1回ごとのイベント送信ではありません。
 * すぐに登録→取消した回答など、巡回の間に消えた変更は検知できません。
 *
 * このスクリプトはGitHub Pagesでは実行しません。Apps Scriptに私有で貼り付けてください。
 */
const BASKET_CONFIG = {
  projectId: 'aritama-mini-basket',
  teamId: 'aritama-mini-basket',
  recipient: 'tutumi2011kt@gmail.com',
  checkMinutes: 15,
  firstMonth: '2027-01',
  lastMonth: '2027-11',
  maximumDocumentsPerMonth: 400
};
const BASKET_DB_PREFIX =
  'https://firestore.googleapis.com/v1/projects/' + BASKET_CONFIG.projectId +
  '/databases/(default)/documents/';

function plusBasketMonth_(month, offset) {
  const a = month.split('-').map(Number);
  return new Date(Date.UTC(a[0], a[1] - 1 + offset, 1)).toISOString().slice(0, 7);
}
function firestoreGet_(path, params) {
  const query = params ? '?' + Object.entries(params).map(
    ([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))
  ).join('&') : '';
  const response = UrlFetchApp.fetch(BASKET_DB_PREFIX + path + query, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Firestoreの読み取りに失敗しました (HTTP ' + status +
      ')。GoogleアカウントのIAM権限とAPI有効化を確認してください。');
  }
  return JSON.parse(response.getContentText() || '{}');
}
function rosterFields_() {
  const doc = firestoreGet_('teams/' + BASKET_CONFIG.teamId + '/public/roster');
  return doc.fields || {};
}
function publishedMonths_(fields) {
  const values = fields.publishedMonths?.arrayValue?.values || [];
  return values.map(v => v.stringValue).filter(x => /^\d{4}-\d{2}$/.test(x));
}
function memberNames_(fields) {
  const values = fields.members?.arrayValue?.values || [];
  const result = {};
  values.forEach(item => {
    const f = item.mapValue?.fields || {};
    if (f.id?.stringValue && f.name?.stringValue) result[f.id.stringValue] = f.name.stringValue;
  });
  return result;
}
function monitoredMonths_(published) {
  const current = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
  const wanted = [1, 2, 3].map(n => plusBasketMonth_(current, n));
  return wanted.filter(m => m >= BASKET_CONFIG.firstMonth &&
    m <= BASKET_CONFIG.lastMonth && published.includes(m));
}
function getBasketAnswers_(month) {
  const data = {};
  let pageToken = '';
  let total = 0;
  do {
    const params = { pageSize: 100 };
    if (pageToken) params.pageToken = pageToken;
    const result = firestoreGet_('teams/' + BASKET_CONFIG.teamId +
      '/months/' + month + '/answers', params);
    (result.documents || []).forEach(d => {
      total++;
      if (total > BASKET_CONFIG.maximumDocumentsPerMonth) {
        throw new Error(month + ' の回答数が想定上限を超えました。読み取り監視を停止しました。');
      }
      const id = d.name.split('/').pop();
      const f = d.fields || {};
      const kind = f.kind?.stringValue;
      const date = f.date?.stringValue;
      const memberId = f.memberId?.stringValue;
      if (!['x', 'o'].includes(kind) || !date || !memberId) {
        throw new Error(month + ' の回答データ形式を確認してください。');
      }
      data[id] = { date, memberId, kind, updateTime: d.updateTime || '' };
    });
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return data;
}
// Apps ScriptのScript Propertiesは1項目9KB制限があるため分割保存。
function statePrefix_(month) { return 'basket.mail.snapshot.' + month + '.'; }
function loadBasketState_(props, month) {
  const key = statePrefix_(month);
  const pointer = props.getProperty(key + 'current');
  if (pointer === null) return null; // 初回のみ通知せず現状を記録する
  const parts = pointer.split(':');
  const count = Number(parts[1]);
  if (!parts[0] || !Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('保存済み通知状態の形式が不正です: ' + month);
  }
  let json = '';
  for (let i = 0; i < count; i++) {
    const chunk = props.getProperty(key + parts[0] + '.' + i);
    if (chunk === null) throw new Error('通知状態が途中で失われました: ' + month);
    json += chunk;
  }
  return JSON.parse(json);
}
function saveBasketState_(props, month, data) {
  const key = statePrefix_(month);
  const json = JSON.stringify(data);
  const chunks = json.match(/[\s\S]{1,7000}/g) || ['{}'];
  if (chunks.length > 100) throw new Error('通知状態が保存上限を超えました: ' + month);
  const old = props.getProperty(key + 'current');
  const version = String(Date.now()) + '-' + String(Math.floor(Math.random() * 100000));
  chunks.forEach((chunk, i) => props.setProperty(key + version + '.' + i, chunk));
  props.setProperty(key + 'current', version + ':' + chunks.length);
  if (old) {
    const parts = old.split(':');
    for (let i = 0; i < Number(parts[1]); i++) {
      props.deleteProperty(key + parts[0] + '.' + i);
    }
  }
}
function detectBasketChanges_(before, after) {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...ids].sort().flatMap(id => {
    const a = before[id], b = after[id];
    if (!a && b) return [{ type: 'new', ...b }];
    if (a && !b) return [{ type: 'removed', ...a }];
    if (a && b && (a.kind !== b.kind || a.updateTime !== b.updateTime)) {
      return [{ type: 'changed', beforeKind: a.kind, ...b }];
    }
    return [];
  });
}
function basketChangeText_(row, names) {
  const k = row.kind === 'x' ? '× 当番ができない' : '○ 代わりにできる';
  const action = row.type === 'new' ? '登録' :
    row.type === 'removed' ? '取消' : '変更';
  return row.date + '　' + (names[row.memberId] || row.memberId) +
    '　' + k + '　' + action;
}
/** 15分ごとのインストール型トリガーから実行する。 */
function pollBasketChanges() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const fields = rosterFields_();
    const names = memberNames_(fields);
    const months = monitoredMonths_(publishedMonths_(fields));
    for (const month of months) {
      const current = getBasketAnswers_(month);
      const previous = loadBasketState_(props, month);
      if (previous === null) {
        saveBasketState_(props, month, current);
        console.log(month + ': 通知の初期状態を保存。既存回答はメールしません。');
        continue;
      }
      const changes = detectBasketChanges_(previous, current);
      if (!changes.length) continue;
      if (MailApp.getRemainingDailyQuota() < 1) {
        throw new Error('Gmailの無料送信枠が残っていません。通知状態を更新しません。');
      }
      const subject = '【ミニバス当番】' + month + ' ×・○の変更 ' + changes.length + '件';
      const body = [
        '有玉女子ミニバス 保護者入力の変更通知',
        '対象月：' + month,
        '検知件数：' + changes.length + '件',
        '',
        ...changes.map(c => basketChangeText_(c, names)),
        '',
        '※保護者の確定操作ごとではなく、定期照合で検知した差分です。',
        '※登録と取消が照合の間に両方行われると検知できない場合があります。',
        '※子どもの名前選択は本人確認ではありません。',
        '※○の回答だけでは当番交代は確定しません。'
      ].join('\n');
      // メール送信が成功してから前回状態を更新。送信失敗時は次回リトライ。
      MailApp.sendEmail({ to: BASKET_CONFIG.recipient, subject, body });
      saveBasketState_(props, month, current);
      console.log(month + ': 管理者宛に ' + changes.length + ' 件を通知しました。');
    }
  } finally {
    lock.releaseLock();
  }
}
/** 初回に手動実行する。過去の回答はメールせず、以降の変更だけ通知する。 */
function setupFreeBasketMail() {
  pollBasketChanges();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pollBasketChanges')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pollBasketChanges').timeBased()
    .everyMinutes(BASKET_CONFIG.checkMinutes).create();
  console.log('15分ごとの無料通知を設定しました。');
}
/** 設定した送信先にテストメールを1通送る。 */
function testFreeBasketMail() {
  MailApp.sendEmail(BASKET_CONFIG.recipient,
    '【ミニバス当番】無料GAS通知 テスト',
    'このメールが届けばGASからGmailへの送信は成功しています。');
}
/** 停止したいときに手動実行する。Firestore回答は削除しません。 */
function stopFreeBasketMail() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pollBasketChanges')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('通知トリガーを停止しました。');
}
