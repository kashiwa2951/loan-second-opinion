/**
 * 画面の配線。計算そのものは calc.js、制度の数値は jasso-data.js が持つ。
 * ここでは入力を読んで、結果を DOM に描くことだけをする。
 */

import {
  buildPlan, plan2shu,
  gengakuEligibility, yuyoEligibility,
  applyGengaku, applyYuyo, applyKuriage, applyEntai,
  payoffDate, yen, monthsLabel, returnCount,
} from './calc.js';

import {
  GENGAKU, YUYO, ENTAI, RATES_2SHU, SOURCES, CONSULT,
  DATA_CHECKED_ON, DEFERMENT_MONTHS,
} from './jasso-data.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'loan-second-opinion:v1';

/** サンプルの数値。第二種を4年間・月5万円、利率は令和8年4月の固定方式。 */
const SAMPLE = {
  kind: '2shu', mode: 'monthly',
  m1: 54000, n1: 48, t1: 2592000,
  m2: 50000, n2: 48, t2: 2400000,
  rateMode: 'fixed', rate: 2.722,
  startY: 2026, startM: 10, kuriage: 300000,
  delinquent: false, incomeLinked: false,
  salaried: '1', income: 3200000, children: 0, dependents: 0,
  gengakuRatio: '0.5', gengakuMonths: '12', months: '12',
};

// ------------------------------------------------------------ 入力の読み書き

function readForm() {
  const kind = document.querySelector('input[name="kind"]:checked').value;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const num = (id) => Number($(id).value) || 0;

  const total1 = kind === '2shu' ? 0
    : mode === 'total' ? num('t1') : num('m1') * num('n1');
  const total2 = kind === '1shu' ? 0
    : mode === 'total' ? num('t2') : num('m2') * num('n2');

  return {
    kind, mode, total1, total2,
    ratePct: Number($('rate').value) || 0,
    rateMode: $('rateMode').value,
    startY: num('startY'), startM: num('startM'),
    kuriage: num('kuriage'),
    delinquent: $('delinquent').checked,
    incomeLinked: $('incomeLinked').checked,
    isSalaried: $('salaried').value === '1',
    income: num('income'),
    children: num('children'),
    dependents: num('dependents'),
    gengakuRatio: Number($('gengakuRatio').value),
    gengakuMonths: Number($('gengakuMonths').value),
    months: Number($('months').value),
  };
}

function applyValues(v) {
  for (const [k, val] of Object.entries(v)) {
    if (k === 'kind' || k === 'mode') {
      const el = document.querySelector(`input[name="${k}"][value="${val}"]`);
      if (el) el.checked = true;
      continue;
    }
    const el = $(k);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = val;
  }
}

function snapshot() {
  const out = {};
  for (const k of Object.keys(SAMPLE)) {
    if (k === 'kind' || k === 'mode') {
      out[k] = document.querySelector(`input[name="${k}"]:checked`)?.value;
      continue;
    }
    const el = $(k);
    if (!el) continue;
    out[k] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); } catch { /* 保存できなくても動く */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { applyValues(JSON.parse(raw)); return true; }
  } catch { /* 壊れていたらサンプルで動かす */ }
  return false;
}

// ------------------------------------------------------------ 表示ヘルパー

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

const fmtDate = (d) => `${d.year}年${d.month}月`;

const money = (n) => Math.round(n).toLocaleString('ja-JP');

function kv(dl, label, value, cls, sub) {
  const row = el('div', 'kv');
  row.append(el('dt', null, label));
  const dd = el('dd', cls);
  dd.innerHTML = value + (sub ? `<span class="sub">${sub}</span>` : '');
  row.append(dd);
  dl.append(row);
}

// ------------------------------------------------------------ 描画

function render() {
  const v = readForm();
  const plan = buildPlan({ total1: v.total1, total2: v.total2, ratePct: v.ratePct });

  syncFormVisibility(v, plan);
  renderStats(v, plan);

  if (plan.count === 0) {
    $('options').innerHTML = '<p class="note">貸与月額と貸与月数を入力すると、選択肢の比較が表示されます。</p>';
    $('next').innerHTML = '';
    $('scenarioSec').hidden = true;
    return;
  }

  renderOptions(v, plan);
  renderScenario(v, plan);
  renderNext(v, plan);
  save();
}

/** 種類・入力方法に応じて出し入れする */
function syncFormVisibility(v, plan) {
  $('grp-1shu').hidden = v.kind === '2shu';
  $('grp-2shu').hidden = v.kind === '1shu';
  for (const node of document.querySelectorAll('[data-mode]')) {
    node.hidden = node.dataset.mode !== v.mode;
  }
  $('incomeLabel').textContent = v.isSalaried ? '年間収入金額' : '年間所得金額';

  const c1 = returnCount(v.total1);
  const c2 = returnCount(v.total2);
  $('hint1').textContent = v.total1 > 0
    ? `貸与総額 ${money(v.total1)}円 → 返還回数 ${c1}回（${c1 / 12}年）`
    : '';
  $('hint2').textContent = v.total2 > 0
    ? `貸与総額 ${money(v.total2)}円 → 返還回数 ${c2}回（${c2 / 12}年）`
    : '';
}

function renderStats(v, plan) {
  const box = $('stats');
  box.innerHTML = '';
  if (plan.count === 0) {
    box.innerHTML = '<div class="stat"><dt>状態</dt><dd style="font-size:1rem">未入力</dd></div>';
    $('planNote').textContent = '';
    return;
  }

  const payoff = payoffDate(v.startY, v.startM, plan.count);
  const add = (label, value, unit, cls) => {
    const d = el('dl', `stat ${cls || ''}`);
    d.append(el('dt', null, label));
    d.append(el('dd', null, `${value}${unit ? `<small>${unit}</small>` : ''}`));
    box.append(d);
  };

  add('毎月の返還額', money(plan.monthly), '円', 'stat--accent');
  add('返還回数', plan.count, `回（${plan.count / 12}年）`);
  add('完済予定', fmtDate(payoff), '');
  add('返還総額', money(plan.repayTotal), '円');
  add('うち利息', money(plan.interest), '円', plan.interest > 0 ? 'stat--warn' : '');

  const parts = [];
  if (plan.kind === 'heiyo') {
    parts.push('併用貸与は第一種と第二種で返還回数が別々に決まるため、完済予定は長いほうに合わせています。');
  }
  if (plan.interest === 0) {
    parts.push('第一種は無利子なので、返還総額は借りた額と同じです。');
  } else {
    parts.push(`利率 ${v.ratePct}% で計算しています。実際の利率は貸与終了月に確定した値が適用されるため、返還予定表で確認してください。`);
  }
  $('planNote').textContent = parts.join('');
}

function renderOptions(v, plan) {
  const box = $('options');
  box.innerHTML = '';

  const payoffOf = (count) => fmtDate(payoffDate(v.startY, v.startM, count));
  const gEl = gengakuEligibility({
    income: v.income, isSalaried: v.isSalaried,
    dependentChildren: v.children, dependents: v.dependents,
    isDelinquent: v.delinquent, isIncomeLinked: v.incomeLinked,
  });
  const yEl = yuyoEligibility({ income: v.income, isSalaried: v.isSalaried });

  const g = applyGengaku(plan, v.gengakuRatio, v.gengakuMonths);
  const y = applyYuyo(plan, v.months);
  const k = applyKuriage(plan, v.kuriage);
  const e = applyEntai(plan, v.months);

  const ratioLabel = GENGAKU.ratios.find((r) => Math.abs(r.value - v.gengakuRatio) < 1e-9)?.label ?? '';

  // --- 1. そのまま
  card(box, {
    cls: 'opt--base',
    title: 'そのまま返す',
    desc: '手続きをせず、当初の予定どおりに返還する',
    rows: [
      ['毎月の返還額', `${money(plan.monthly)}円`, 'v-flat'],
      ['完済予定', payoffOf(plan.count), 'v-flat'],
      ['返還総額', `${money(plan.repayTotal)}円`, 'v-flat'],
      ['追加のコスト', 'なし', 'v-flat'],
      ['信用情報', '影響なし', 'v-flat'],
    ],
    foot: '基準となる選択肢です。以下はここからの差分で表示しています。',
  });

  // --- 2. 減額返還
  card(box, {
    cls: gEl.eligible ? 'opt--good' : '',
    badge: gEl.eligible
      ? { cls: 'badge--ok', text: '使える見込み' }
      : { cls: 'badge--no', text: '要件を満たしていません' },
    title: `減額返還（${ratioLabel}）`,
    desc: `月々を${ratioLabel}に減らして、期間を延ばす制度`,
    rows: [
      ['毎月の返還額', `${money(g.monthly)}円`, 'v-good', `${money(g.monthlyDelta)}円`],
      ['完済予定', payoffOf(g.count), 'v-flat', monthsLabel(g.extraMonths)],
      ['返還総額', `${money(g.repayTotal)}円`, 'v-good', '変わらない'],
      ['追加のコスト', '0円', 'v-good'],
      ['信用情報', '影響なし', 'v-good'],
    ],
    foot: gEl.eligible
      ? `${gEl.incomeKind} ${money(gEl.adjustedIncome)}円 ≦ 基準 ${money(gEl.limit)}円。適用は1回${GENGAKU.monthsPerApplication}か月、通算${GENGAKU.maxTotalMonths / 12}年まで。`
      : gEl.blockers.length
        ? gEl.blockers.join('　')
        : `${gEl.incomeKind} ${money(gEl.adjustedIncome)}円 が基準 ${money(gEl.limit)}円 を超えています。`,
    footCls: gEl.eligible ? 'is-ok' : 'is-block',
  });

  // --- 3. 返還期限猶予
  card(box, {
    cls: yEl.eligible ? 'opt--good' : '',
    badge: yEl.eligible
      ? { cls: 'badge--ok', text: '使える見込み' }
      : { cls: 'badge--no', text: '要件を満たしていません' },
    title: `返還期限猶予（${v.months}か月）`,
    desc: '返還そのものを先送りする制度。免除ではない',
    rows: [
      ['毎月の返還額', '0円', 'v-good', `${money(y.monthlyDelta)}円`],
      ['完済予定', payoffOf(y.count), 'v-flat', monthsLabel(y.extraMonths)],
      ['返還総額', `${money(y.repayTotal)}円`, 'v-good', '変わらない'],
      ['追加のコスト', '0円', 'v-good'],
      ['信用情報', '影響なし', 'v-good'],
    ],
    foot: yEl.eligible
      ? `${yEl.incomeKind} ${money(v.income)}円 ≦ 基準 ${money(yEl.limit)}円。一般猶予は通算${YUYO.maxTotalMonths / 12}年まで。延滞していても申請できます。`
      : `経済困難の基準（${yEl.incomeKind} ${money(yEl.limit)}円）を超えています。災害・傷病・生活保護受給中などは別の事由として申請でき、通算年数の上限もありません。`,
    footCls: yEl.eligible ? 'is-ok' : '',
  });

  // --- 4. 繰上返還
  const saved = k.interestSaved ?? 0;
  card(box, {
    badge: { cls: 'badge--flat', text: 'いつでも可' },
    title: `繰上返還（${money(k.amount)}円）`,
    desc: 'まとまった額を前倒しで返し、期間と利息を減らす',
    rows: [
      ['毎月の返還額', `${money(k.monthly)}円`, 'v-flat', '変わらない'],
      ['完済予定', payoffOf(k.count), 'v-good', monthsLabel(k.extraMonths)],
      ['返還総額', `${money(k.repayTotal)}円`, saved > 0 ? 'v-good' : 'v-flat',
        saved > 0 ? `利息 −${money(saved)}円` : '変わらない'],
      ['追加のコスト', '0円', 'v-flat'],
      ['信用情報', '影響なし', 'v-flat'],
    ],
    foot: plan.interest === 0
      ? '第一種は無利子なので、繰上返還しても総額は変わりません。完済が早まるだけです。手元の資金に余裕があるかを先に考えてください。'
      : `利息が ${money(saved)}円 減ります。ただし手元の資金が減るので、生活防衛資金を削ってまで急ぐ必要はありません。`,
  });

  // --- 5. 延滞
  // 延滞金そのものは小さい。金額だけ見て「延滞は安い」と誤解されないよう、
  // 一括請求・信用情報・減額返還が使えなくなることを同じ強さで並べる。
  card(box, {
    cls: 'opt--danger',
    badge: { cls: 'badge--no', text: '避けたい選択肢' },
    title: `延滞した場合（${v.months}か月）`,
    desc: '手続きをせずに支払いを止めるとこうなる',
    rows: [
      ['未払いの累計', `${money(e.arrears)}円`, 'v-danger', `毎月の返還額 × ${v.months}か月`],
      ['延滞金', `${money(e.extraCost)}円`, 'v-warn', `年${ENTAI.annualRate * 100}%（元金部分に日割り）`],
      ['一括請求のリスク', `${money(e.lumpSumRisk)}円`, 'v-danger', '期限の利益を失うと残額の全額'],
      ['信用情報', e.creditImpact ? '登録される' : 'まだ影響なし', e.creditImpact ? 'v-danger' : 'v-warn',
        e.creditImpact ? `完済から${ENTAI.creditRetentionYearsAfterPayoff}年後まで残る` : `${ENTAI.creditRegistrationMonths}か月で登録`],
      ['減額返還', '使えなくなる', 'v-danger', '延滞中は願い出できない'],
    ],
    foot: '延滞金の額そのものは大きくありません。効いてくるのは、'
      + `${e.creditNote.replace(/^個人信用情報機関に/, '信用情報に')}、`
      + '督促に応じないと返還期日が来ていない分まで一括請求されること（期限の利益の喪失）、'
      + 'そして連帯保証人や保証機関に請求が回り、その先に差押えなどの法的措置があることです。',
    footCls: 'is-block',
  });
}

function card(parent, { cls = '', badge, title, desc, rows, foot, footCls = '' }) {
  const c = el('article', `opt ${cls}`);
  const hd = el('div', 'opt-hd');
  if (badge) hd.append(el('span', `badge ${badge.cls}`, badge.text));
  hd.append(el('h3', null, title));
  if (desc) hd.append(el('p', null, desc));
  c.append(hd);

  const dl = el('dl');
  for (const [label, value, vcls, sub] of rows) kv(dl, label, value, vcls, sub);
  c.append(dl);

  if (foot) c.append(el('div', `opt-foot ${footCls}`, foot));
  parent.append(c);
}

function renderScenario(v, plan) {
  const sec = $('scenarioSec');
  const show = v.kind !== '1shu' && v.total2 > 0 && v.rateMode === 'review';
  sec.hidden = !show;
  if (!show) return;

  $('scenarioLead').textContent =
    `利率見直し方式は、おおむね${RATES_2SHU.review.reviewIntervalYears}年ごとに利率が見直されます。`
    + `いまの利率が将来も続くとは限らないので、上がった場合も見ておいてください。`
    + `第二種の利率には年${RATES_2SHU.cap}%の上限があります。`;

  const box = $('scenario');
  box.innerHTML = '';
  const base = plan2shu(v.total2, v.ratePct);
  const cap = RATES_2SHU.cap;

  // 上限を超える利率は存在しないので、頭打ちになったシナリオは重複させずに畳む。
  const scenarios = [{ note: 'いま', rate: v.ratePct }];
  for (const [note, r] of [['+1%', v.ratePct + 1], ['+2%', v.ratePct + 2], ['上限', cap]]) {
    const rate = Math.min(r, cap);
    if (scenarios.some((s) => Math.abs(s.rate - rate) < 1e-9)) continue;
    scenarios.push({ note: rate === cap ? '上限' : note, rate });
  }

  for (const s of scenarios) {
    const p = plan2shu(v.total2, s.rate);
    const cell = el('div', 'scen-cell');
    cell.append(el('h3', null, `${s.note}（${s.rate}%）`));
    cell.append(el('span', 'big', `${money(p.monthly)}円`));
    const d = p.repayTotal - base.repayTotal;
    cell.append(el('span', 'delta', d === 0 ? '基準' : `総額 +${money(d)}円`));
    cell.append(el('span', 'sm', `返還総額 ${money(p.repayTotal)}円 / うち利息 ${money(p.interest)}円`));
    box.append(cell);
  }
}

function renderNext(v, plan) {
  const box = $('next');
  box.innerHTML = '';
  let n = 0;

  const step = (title, body, tone = '') => {
    const s = el('div', `step ${tone}`);
    s.append(el('div', 'n', String(++n)));
    const b = el('div');
    b.append(el('h3', null, title));
    for (const p of [].concat(body)) b.append(el('p', null, p));
    s.append(b);
    box.append(s);
  };

  const gEl = gengakuEligibility({
    income: v.income, isSalaried: v.isSalaried,
    dependentChildren: v.children, dependents: v.dependents,
    isDelinquent: v.delinquent, isIncomeLinked: v.incomeLinked,
  });
  const yEl = yuyoEligibility({ income: v.income, isSalaried: v.isSalaried });

  if (v.delinquent) {
    step('まず延滞を解消できるか確認する',
      [
        '延滞している間は減額返還を願い出できません。先に延滞分を解消すると、減額返還という選択肢が戻ってきます。',
        `返還期限猶予は延滞中でも申請できます。<a href="${SOURCES.yuyo.url}" target="_blank" rel="noopener">返還期限猶予のページ</a>を確認してください。`,
      ], 'is-danger');
  }

  if (gEl.eligible) {
    step('減額返還を検討する',
      [
        `いまの${gEl.incomeKind}なら基準（${money(gEl.limit)}円）を満たしています。返還総額も利子総額も増えないので、返せない月が続きそうなら延滞する前に願い出るほうが確実に有利です。`,
        `手続きは<a href="${SOURCES.gengaku.url}" target="_blank" rel="noopener">減額返還制度の概要</a>と<a href="${SOURCES.scholarPS.url}" target="_blank" rel="noopener">スカラネット・パーソナル</a>から。証明書の提出が必要です。`,
      ]);
  } else if (yEl.eligible) {
    step('返還期限猶予を検討する',
      [
        `減額返還の収入基準は超えていますが、返還期限猶予の基準（${yEl.incomeKind} ${money(yEl.limit)}円）は満たしています。`,
        `<a href="${SOURCES.yuyoKeikon.url}" target="_blank" rel="noopener">経済困難による一般猶予</a>を確認してください。`,
      ]);
  } else {
    step('いまは制度の収入基準を超えている',
      [
        `減額返還も返還期限猶予も、経済困難を理由とした収入基準は満たしていません。いまのところ通常どおり返還を続けるのが基本になります。`,
        '収入が下がったとき、失業したとき、傷病・災害にあったときは基準が変わります。そのときにこのページに戻ってきてください。',
      ], 'is-warn');
  }

  if (plan.interest > 0 && v.kuriage > 0) {
    const k = applyKuriage(plan, v.kuriage);
    step('繰上返還は「生活防衛資金を残したうえで」',
      `${money(v.kuriage)}円 を繰り上げると利息が ${money(k.interestSaved)}円 減り、完済が ${monthsLabel(k.extraMonths).replace('−', '')}早まります。`
      + 'ただし手元の現金が減ります。失業や病気に備えた資金を削ってまで急ぐ必要はありません。');
  }

  step('自分の正確な数字を確認する',
    `このページの計算は入力値にもとづく概算です。<a href="${SOURCES.scholarPS.url}" target="_blank" rel="noopener">スカラネット・パーソナル</a>で返還残額・返還残回数・適用利率を確認すると、より正確に比較できます。`);
}

function renderStatic() {
  // 減額返還の割合セレクト
  const sel = $('gengakuRatio');
  sel.innerHTML = '';
  for (const r of GENGAKU.ratios) {
    const o = el('option', null, `${r.label}に減額`);
    o.value = String(r.value);
    sel.append(o);
  }
  sel.value = '0.5';

  // 相談先
  const cs = $('consult');
  for (const c of CONSULT) {
    const li = el('li');
    li.innerHTML = `<b><a href="${c.url}" target="_blank" rel="noopener">${c.name}</a></b><span>${c.detail}</span>`;
    cs.append(li);
  }

  // 出典
  const ss = $('srcs');
  for (const s of Object.values(SOURCES)) {
    ss.append(el('li', null, `<a href="${s.url}" target="_blank" rel="noopener">JASSO｜${s.label}</a>`));
  }

  // 精度の説明
  $('accuracy').innerHTML =
    '返還回数は、JASSOが公開している割賦金基礎額表にもとづいて計算しています。'
    + '<b>第一種（無利子）は、JASSO公式の返還例と完全に一致します。</b>'
    + '第二種は、貸与終了から返還開始までの据置期間の利息の扱いをJASSOが公開していないため、'
    + `公式返還例48件に対して較正した値（据置${DEFERMENT_MONTHS}か月相当）を使っています。`
    + 'その結果、<b>返還月額の誤差は最大1円、返還総額の誤差は最大51円（相対0.0005%）</b>に収まっています。'
    + '減額返還の延長月数は「適用月数 ×（1 − 減額割合）」で概算しており、実際の返還期間はJASSOの承認内容で決まります。';

  $('footNote').textContent =
    `制度の数値と利率は ${DATA_CHECKED_ON} 時点でJASSO公式サイトを確認したものです。`
    + '第二種の利率は毎月決定されるため、実際の適用利率はご自身の返還予定表で確認してください。';
}

// ------------------------------------------------------------ 起動

function init() {
  renderStatic();
  if (!restore()) applyValues(SAMPLE);
  render();

  $('form').addEventListener('input', render);
  $('form').addEventListener('change', render);
  for (const id of ['gengakuRatio', 'gengakuMonths', 'months']) {
    $(id).addEventListener('change', render);
  }
  $('reset').addEventListener('click', () => {
    applyValues(SAMPLE);
    $('gengakuRatio').value = SAMPLE.gengakuRatio;
    $('gengakuMonths').value = SAMPLE.gengakuMonths;
    $('months').value = SAMPLE.months;
    render();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
