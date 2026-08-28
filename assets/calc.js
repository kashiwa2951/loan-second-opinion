/**
 * 奨学金返還の計算エンジン。
 *
 * すべて純関数。DOM にも localStorage にも触れない。
 * test/calc.test.mjs が JASSO 公式返還例58件に対して検証している。
 */

import {
  KISOGAKU_TABLE, MAX_RETURN_YEARS, DEFERMENT_MONTHS,
  GENGAKU, YUYO, ENTAI, SHOTOKU_RENDO,
} from './jasso-data.js';

// ---------------------------------------------------------------- 返還回数

/** 貸与総額に対応する割賦金基礎額。3,400,001円以上は総額の1/20。 */
export function kisogaku(total) {
  const row = KISOGAKU_TABLE.find((r) => total <= r.upTo);
  return row.base ?? total / 20;
}

/** 返還年数 = floor(貸与総額 / 割賦金基礎額)。第一種・第二種で共通。 */
export function returnYears(total) {
  if (total <= 0) return 0;
  return Math.min(Math.floor(total / kisogaku(total)), MAX_RETURN_YEARS);
}

/** 月賦返還の回数 */
export function returnCount(total) {
  return returnYears(total) * 12;
}

// ---------------------------------------------------------------- 返還プラン

function emptyPlan() {
  return {
    kind: 'none', principal: 0, count: 0, years: 0, monthly: 0, lastPayment: 0,
    repayTotal: 0, interest: 0, ratePct: 0, exact: true,
  };
}

/**
 * 第一種（無利子・定額返還方式）。
 * 返還月額 = floor(貸与総額 / 返還回数)、端数は最終回で調整。
 */
export function plan1shu(total) {
  const count = returnCount(total);
  if (count === 0) return emptyPlan();
  const monthly = Math.floor(total / count);
  return {
    kind: '1shu',
    principal: total,
    count,
    years: count / 12,
    monthly,
    lastPayment: total - monthly * (count - 1),
    repayTotal: total,
    interest: 0,
    ratePct: 0,
    exact: true,
  };
}

/** 元利均等返還の償還表。割賦金・各回の利息はいずれも円未満切り捨て。 */
export function amortize(principal, annual, count) {
  const r = annual / 12;
  const payment = Math.floor((principal * r) / (1 - Math.pow(1 + r, -count)));
  let balance = principal;
  let paid = 0;
  let lastPayment = payment;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const interest = Math.floor(balance * r);
    if (i === count - 1) {
      lastPayment = balance + interest;
      paid += lastPayment;
      rows.push({ i: i + 1, payment: lastPayment, interest, principal: balance, balance: 0 });
      balance = 0;
    } else {
      const toPrincipal = payment - interest;
      balance -= toPrincipal;
      paid += payment;
      rows.push({ i: i + 1, payment, interest, principal: toPrincipal, balance });
    }
  }
  return { payment, lastPayment, paid, rows };
}

/**
 * 第二種（有利子・元利均等返還）。
 *
 * 返還開始前の据置期間ぶんの利息を加算する。JASSO は正確な式を公開していないため、
 * 公式返還例で較正した DEFERMENT_MONTHS を使う（概算。誤差は test で監視）。
 */
export function plan2shu(total, annualRatePct) {
  const count = returnCount(total);
  if (count === 0) return emptyPlan();
  const annual = annualRatePct / 100;
  if (annual <= 0) return { ...plan1shu(total), kind: '2shu', ratePct: 0 };

  const schedule = amortize(total, annual, count);
  const deferment = Math.round(total * annual * (DEFERMENT_MONTHS / 12));
  const repayTotal = schedule.paid + deferment;
  // JASSO が示す「返還月額」は据置期間の利息も均した 返還総額 ÷ 回数。
  const monthly = Math.floor(repayTotal / count);

  return {
    kind: '2shu',
    principal: total,
    count,
    years: count / 12,
    monthly,
    // 償還表上の割賦金。据置期間の利息を均す前の値で、繰上返還の試算に使う。
    amortPayment: schedule.payment,
    lastPayment: repayTotal - monthly * (count - 1),
    repayTotal,
    interest: repayTotal - total,
    defermentInterest: deferment,
    ratePct: annualRatePct,
    schedule: schedule.rows,
    exact: false,
  };
}

const sum = (arr, key) => arr.reduce((a, x) => a + x[key], 0);

/** 入力から現状の返還プランを組み立てる。併用貸与は2件を合算する。 */
export function buildPlan(input) {
  const parts = [];
  if (input.total1 > 0) parts.push(plan1shu(input.total1));
  if (input.total2 > 0) parts.push(plan2shu(input.total2, input.ratePct));
  if (parts.length === 0) return { ...emptyPlan(), parts: [] };
  if (parts.length === 1) return { ...parts[0], parts };

  // 併用: 第一種と第二種は別々に返還回数が決まる。長い方が完済時期になる。
  const count = Math.max(...parts.map((p) => p.count));
  return {
    kind: 'heiyo',
    principal: sum(parts, 'principal'),
    count,
    years: count / 12,
    monthly: sum(parts, 'monthly'),
    lastPayment: sum(parts, 'lastPayment'),
    repayTotal: sum(parts, 'repayTotal'),
    interest: sum(parts, 'interest'),
    ratePct: input.ratePct,
    exact: parts.every((p) => p.exact),
    schedule: parts.find((p) => p.schedule)?.schedule,
    parts,
  };
}

// ---------------------------------------------------------------- 制度の適格判定

/**
 * 減額返還の収入要件を満たすか。
 * 被扶養者1人につき38万円を収入・所得金額から控除して判定する。
 */
export function gengakuEligibility({
  income, isSalaried, dependentChildren = 0, dependents = 0,
  isDelinquent = false, isIncomeLinked = false,
}) {
  const limits = isSalaried ? GENGAKU.incomeLimits.salaried : GENGAKU.incomeLimits.other;
  const limit = dependentChildren >= 3 ? limits.children3plus
    : dependentChildren === 2 ? limits.children2
      : limits.base;
  const adjusted = Math.max(0, income - dependents * GENGAKU.dependentDeduction);
  const blockers = [];
  if (isDelinquent) blockers.push('延滞している間は願い出できません（延滞を解消すれば申請できます）');
  if (isIncomeLinked) blockers.push('所得連動返還方式を選択している場合は対象外です');
  return {
    limit,
    adjustedIncome: adjusted,
    meetsIncome: adjusted <= limit,
    eligible: adjusted <= limit && blockers.length === 0,
    blockers,
    incomeKind: isSalaried ? '年間収入金額' : '年間所得金額',
  };
}

/** 返還期限猶予（一般猶予・経済困難）の収入要件を満たすか。 */
export function yuyoEligibility({ income, isSalaried }) {
  const limit = isSalaried ? YUYO.incomeLimits.salaried : YUYO.incomeLimits.other;
  return {
    limit,
    meetsIncome: income <= limit,
    eligible: income <= limit,
    incomeKind: isSalaried ? '年間収入金額' : '年間所得金額',
  };
}

// ---------------------------------------------------------------- 制度を適用した結果

/**
 * 減額返還を適用した場合。
 *
 * 返還予定総額も第二種の利子総額も変わらない（JASSO明記）。
 * 適用期間中に払わなかった分が後ろにずれるだけなので、
 * 延長月数 = 適用月数 × (1 - 減額割合)。実際の期間はJASSOの承認内容で決まる。
 */
export function applyGengaku(plan, ratio, monthsApplied) {
  const months = Math.min(monthsApplied, GENGAKU.maxTotalMonths);
  const reduced = Math.floor(plan.monthly * ratio);
  const extraMonths = Math.round(months * (1 - ratio));
  return {
    monthly: reduced,
    monthlyDelta: reduced - plan.monthly,
    monthsApplied: months,
    extraMonths,
    count: plan.count + extraMonths,
    repayTotal: plan.repayTotal,
    repayTotalDelta: 0,
    extraCost: 0,
    creditImpact: false,
  };
}

/**
 * 返還期限猶予を適用した場合。
 * 返還そのものが先送りされるだけで、元金も利子も減らない。
 */
export function applyYuyo(plan, monthsDeferred) {
  const months = Math.min(monthsDeferred, YUYO.maxTotalMonths);
  return {
    monthly: 0,
    monthlyDelta: -plan.monthly,
    monthsDeferred: months,
    extraMonths: months,
    count: plan.count + months,
    repayTotal: plan.repayTotal,
    repayTotalDelta: 0,
    extraCost: 0,
    creditImpact: false,
  };
}

/** 残元金を同じ月額で返した場合に何回で終わるかを求め、短縮月数を返す。 */
function monthsSaved(remaining, annual, monthly, originalCount) {
  if (remaining <= 0) return originalCount;
  const r = annual / 12;
  if (r === 0) return Math.min(originalCount, originalCount - Math.ceil(remaining / monthly));
  if (monthly <= remaining * r) return 0; // 利息すら払えない場合は短縮しない
  const n = Math.ceil(-Math.log(1 - (remaining * r) / monthly) / Math.log(1 + r));
  return Math.max(0, originalCount - n);
}

/**
 * 繰上返還した場合。
 * 第一種は無利子なので期間が縮むだけ。第二種は将来利息が減る。
 */
export function applyKuriage(plan, amount) {
  const amt = Math.max(0, Math.min(amount, plan.principal));
  if (amt === 0) {
    return {
      monthly: plan.monthly, monthlyDelta: 0, amount: 0, extraMonths: 0,
      count: plan.count, repayTotal: plan.repayTotal, repayTotalDelta: 0,
      interestSaved: 0, extraCost: 0, creditImpact: false,
    };
  }
  if (plan.ratePct <= 0) {
    const shorter = Math.min(plan.count, Math.floor(amt / plan.monthly));
    return {
      monthly: plan.monthly,
      monthlyDelta: 0,
      amount: amt,
      extraMonths: -shorter,
      count: plan.count - shorter,
      repayTotal: plan.repayTotal,
      repayTotalDelta: 0,
      interestSaved: 0,
      extraCost: 0,
      creditImpact: false,
    };
  }
  const annual = plan.ratePct / 100;
  const remaining = plan.principal - amt;
  // 短縮月数は償還表上の割賦金で見る。表示用の月額は据置利息を均した値なので使えない。
  const shorter = monthsSaved(remaining, annual, plan.amortPayment ?? plan.monthly, plan.count);
  const newCount = Math.max(0, plan.count - shorter);
  const paid = newCount > 0 ? amortize(remaining, annual, newCount).paid : 0;
  const newTotal = amt + paid + (plan.defermentInterest ?? 0);
  return {
    monthly: plan.monthly,
    monthlyDelta: 0,
    amount: amt,
    extraMonths: -shorter,
    count: newCount,
    repayTotal: newTotal,
    repayTotalDelta: newTotal - plan.repayTotal,
    interestSaved: plan.repayTotal - newTotal,
    extraCost: 0,
    creditImpact: false,
  };
}

/** 延滞金の賦課対象額。第二種は割賦金から利子部分を除く。 */
export function entaiBase(plan) {
  if (!ENTAI.baseExcludesInterest || !plan.schedule || plan.schedule.length === 0) {
    return plan.monthly;
  }
  const principalPortion = plan.schedule[0].principal;
  if (plan.kind === 'heiyo') {
    const p1 = plan.parts.find((p) => p.kind === '1shu');
    return principalPortion + (p1 ? p1.monthly : 0);
  }
  return principalPortion;
}

/**
 * 延滞した場合。
 *
 * 延滞金そのものは大きくない。本当のコストは
 *   1. 個人信用情報機関への登録（3か月以上・完済から5年間残る）
 *   2. 期限の利益の喪失＝返還未済額の全額一括請求
 *   3. 連帯保証人・保証機関への請求と、その後の法的措置
 *   4. 延滞している間は減額返還を願い出できなくなること
 * なので、金額だけを見て「延滞は安い」と誤解されないように全部返す。
 *
 * 延滞金 = 延滞した割賦金 × 年3% × 経過日数/365。
 * 賦課対象は割賦金（第二種は利子を除く＝元金部分）。
 * n か月延滞して、その時点でまとめて解消したと仮定して累計する。
 */
export function applyEntai(plan, monthsDelinquent) {
  const n = Math.max(0, monthsDelinquent);
  const base = entaiBase(plan);
  let fee = 0;
  for (let i = 1; i <= n; i++) {
    fee += base * ENTAI.annualRate * ((n - i) / 12);
  }
  fee = Math.round(fee);
  const registered = n >= ENTAI.creditRegistrationMonths;
  return {
    monthly: 0,
    monthlyDelta: -plan.monthly,
    monthsDelinquent: n,
    arrears: plan.monthly * n,
    extraMonths: 0,
    count: plan.count,
    repayTotal: plan.repayTotal + fee,
    repayTotalDelta: fee,
    extraCost: fee,
    /** 期限の利益を喪失した場合に一括で請求されうる額（返還未済額＋延滞金） */
    lumpSumRisk: plan.repayTotal + fee,
    creditImpact: registered,
    creditNote: registered
      ? `個人信用情報機関に登録されます。登録情報は完済から${ENTAI.creditRetentionYearsAfterPayoff}年後まで残ります`
      : `あと${ENTAI.creditRegistrationMonths - n}か月延滞すると登録の対象になります`,
    blocksGengaku: true,
  };
}

/** 所得連動返還方式の返還月額（第一種のみ） */
export function shotokuRendoMonthly(taxableIncome, children = 0) {
  const base = Math.max(0, taxableIncome - children * SHOTOKU_RENDO.childDeduction);
  const monthly = Math.floor((base * SHOTOKU_RENDO.rate) / 12);
  return Math.max(SHOTOKU_RENDO.minMonthly, monthly);
}

// ---------------------------------------------------------------- 表示用

/** 返還開始年月と回数から完済年月を出す */
export function payoffDate(startYear, startMonth, count) {
  if (count <= 0) return { year: startYear, month: startMonth };
  const t = startYear * 12 + (startMonth - 1) + (count - 1);
  return { year: Math.floor(t / 12), month: (t % 12) + 1 };
}

export const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;

export function monthsLabel(m) {
  if (m === 0) return '変わらない';
  const sign = m > 0 ? '+' : '−';
  const abs = Math.abs(m);
  const y = Math.floor(abs / 12);
  const mo = abs % 12;
  if (y && mo) return `${sign}${y}年${mo}か月`;
  if (y) return `${sign}${y}年`;
  return `${sign}${mo}か月`;
}
