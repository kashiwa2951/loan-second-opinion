import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DAI1, DAI2 } from './fixtures-jasso.mjs';
import {
  kisogaku, returnYears, returnCount,
  plan1shu, plan2shu, buildPlan,
  gengakuEligibility, yuyoEligibility,
  applyGengaku, applyYuyo, applyKuriage, applyEntai,
  shotokuRendoMonthly, payoffDate, monthsLabel,
} from '../assets/calc.js';
import { GENGAKU, YUYO, ENTAI } from '../assets/jasso-data.js';

// ------------------------------------------------------------------ 返還回数

describe('割賦金基礎額と返還回数', () => {
  test('区分の境界値', () => {
    assert.equal(kisogaku(200_000), 30_000);
    assert.equal(kisogaku(200_001), 40_000);
    assert.equal(kisogaku(3_400_000), 170_000);
    assert.equal(kisogaku(3_400_001), 3_400_001 / 20, '3,400,001円以上は総額の1/20');
  });

  test('340万円超は一律20年', () => {
    assert.equal(returnYears(3_400_001), 20);
    assert.equal(returnYears(8_640_000), 20);
    assert.equal(returnCount(8_640_000), 240);
  });

  test('貸与額ゼロなら回数もゼロ', () => {
    assert.equal(returnCount(0), 0);
  });
});

// ------------------------------------------------------- 第一種（完全一致必須）

describe('第一種：JASSO公式返還例と完全一致すること', () => {
  for (const f of DAI1) {
    test(`貸与総額 ${f.total.toLocaleString()}円`, () => {
      const p = plan1shu(f.total);
      assert.equal(p.count, f.count, '返還回数');
      assert.equal(p.monthly, f.payment, '返還月額');
      assert.equal(p.repayTotal, f.total, '無利子なので返還総額は元金と同じ');
      assert.equal(p.interest, 0);
    });
  }

  test('端数は最終回で調整され、合計が貸与総額に一致する', () => {
    for (const f of DAI1) {
      const p = plan1shu(f.total);
      assert.equal(p.monthly * (p.count - 1) + p.lastPayment, f.total);
    }
  });
});

// -------------------------------------------------- 第二種（公式値との誤差を監視）

describe('第二種：JASSO公式返還例との一致', () => {
  test('返還回数は全件で完全一致すること', () => {
    for (const f of DAI2) {
      assert.equal(plan2shu(f.total, f.rate).count, f.count,
        `${f.total}円 @${f.rate}%`);
    }
  });

  test('返還月額の誤差が1件あたり5円以内であること', () => {
    let max = 0, worst = null;
    for (const f of DAI2) {
      const d = Math.abs(plan2shu(f.total, f.rate).monthly - f.payment);
      if (d > max) { max = d; worst = f; }
    }
    console.log(`    返還月額の最大誤差: ${max}円 (${worst.total}円 @${worst.rate}%)`);
    assert.ok(max <= 5, `最大誤差 ${max}円 が許容範囲を超えた`);
  });

  test('返還総額の相対誤差が0.001%以内であること', () => {
    let maxAbs = 0, maxRel = 0, worst = null;
    for (const f of DAI2) {
      const got = plan2shu(f.total, f.rate).repayTotal;
      const abs = Math.abs(got - f.repayTotal);
      const rel = abs / f.repayTotal;
      if (abs > maxAbs) { maxAbs = abs; worst = f; }
      if (rel > maxRel) maxRel = rel;
    }
    console.log(`    返還総額の最大誤差: ${maxAbs}円 / 相対 ${(maxRel * 100).toFixed(5)}% (${worst.total}円 @${worst.rate}%)`);
    assert.ok(maxRel < 0.00001, `相対誤差 ${(maxRel * 100).toFixed(5)}% が許容範囲を超えた`);
  });

  test('利率0%なら第一種と同じ結果になる', () => {
    const a = plan2shu(2_160_000, 0);
    const b = plan1shu(2_160_000);
    assert.equal(a.monthly, b.monthly);
    assert.equal(a.repayTotal, b.repayTotal);
  });

  test('利率が上がると返還総額も必ず増える', () => {
    let prev = 0;
    for (const rate of [0.5, 1, 1.874, 2, 2.722, 3]) {
      const t = plan2shu(4_800_000, rate).repayTotal;
      assert.ok(t > prev, `${rate}% で総額が増えていない`);
      prev = t;
    }
  });
});

// ------------------------------------------------------------------ 併用貸与

describe('併用貸与', () => {
  test('第一種と第二種を合算し、長い方の回数を完済時期とする', () => {
    const p = buildPlan({ total1: 1_440_000, total2: 4_800_000, ratePct: 3 });
    const p1 = plan1shu(1_440_000);
    const p2 = plan2shu(4_800_000, 3);
    assert.equal(p.kind, 'heiyo');
    assert.equal(p.principal, 1_440_000 + 4_800_000);
    assert.equal(p.monthly, p1.monthly + p2.monthly);
    assert.equal(p.repayTotal, p1.repayTotal + p2.repayTotal);
    assert.equal(p.count, Math.max(p1.count, p2.count));
  });

  test('片方だけなら単体プランと同じ', () => {
    const only2 = buildPlan({ total1: 0, total2: 2_400_000, ratePct: 1 });
    assert.equal(only2.kind, '2shu');
    assert.equal(only2.monthly, plan2shu(2_400_000, 1).monthly);
  });

  test('未入力なら空のプラン', () => {
    assert.equal(buildPlan({ total1: 0, total2: 0, ratePct: 0 }).count, 0);
  });
});

// ------------------------------------------------------------ 減額返還の適格性

describe('減額返還の収入要件', () => {
  test('給与所得者の境界は400万円ちょうどまで可', () => {
    const at = gengakuEligibility({ income: 4_000_000, isSalaried: true });
    const over = gengakuEligibility({ income: 4_000_001, isSalaried: true });
    assert.equal(at.eligible, true);
    assert.equal(over.eligible, false);
  });

  test('扶養する子の人数で基準が上がる（2人=500万、3人以上=600万）', () => {
    assert.equal(gengakuEligibility({ income: 5_000_000, isSalaried: true, dependentChildren: 2 }).eligible, true);
    assert.equal(gengakuEligibility({ income: 5_000_001, isSalaried: true, dependentChildren: 2 }).eligible, false);
    assert.equal(gengakuEligibility({ income: 6_000_000, isSalaried: true, dependentChildren: 3 }).eligible, true);
    assert.equal(gengakuEligibility({ income: 6_000_000, isSalaried: true, dependentChildren: 5 }).eligible, true);
  });

  test('給与所得以外は所得ベースで300万円', () => {
    assert.equal(gengakuEligibility({ income: 3_000_000, isSalaried: false }).eligible, true);
    assert.equal(gengakuEligibility({ income: 3_000_001, isSalaried: false }).eligible, false);
  });

  test('被扶養者1人につき38万円を控除して判定する', () => {
    const r = gengakuEligibility({ income: 4_300_000, isSalaried: true, dependents: 1 });
    assert.equal(r.adjustedIncome, 4_300_000 - GENGAKU.dependentDeduction);
    assert.equal(r.eligible, true, '控除後3,920,000円なので基準内');
  });

  test('延滞中は収入要件を満たしていても願い出できない', () => {
    const r = gengakuEligibility({ income: 2_000_000, isSalaried: true, isDelinquent: true });
    assert.equal(r.meetsIncome, true);
    assert.equal(r.eligible, false);
    assert.match(r.blockers[0], /延滞/);
  });

  test('所得連動返還方式の選択者は対象外', () => {
    const r = gengakuEligibility({ income: 2_000_000, isSalaried: true, isIncomeLinked: true });
    assert.equal(r.eligible, false);
    assert.match(r.blockers[0], /所得連動/);
  });
});

describe('返還期限猶予の収入要件', () => {
  test('給与所得者300万円 / それ以外は所得200万円', () => {
    assert.equal(yuyoEligibility({ income: 3_000_000, isSalaried: true }).eligible, true);
    assert.equal(yuyoEligibility({ income: 3_000_001, isSalaried: true }).eligible, false);
    assert.equal(yuyoEligibility({ income: 2_000_000, isSalaried: false }).eligible, true);
    assert.equal(yuyoEligibility({ income: 2_000_001, isSalaried: false }).eligible, false);
  });
});

// -------------------------------------------------------- 制度を適用した結果

describe('減額返還を適用した結果', () => {
  const plan = plan2shu(4_800_000, 3);

  test('返還総額も利子総額も一切増えない（この製品の核心）', () => {
    for (const { value } of GENGAKU.ratios) {
      const r = applyGengaku(plan, value, 12);
      assert.equal(r.repayTotalDelta, 0, `割合 ${value} で総額が変わった`);
      assert.equal(r.repayTotal, plan.repayTotal);
      assert.equal(r.extraCost, 0);
    }
  });

  test('月額は選んだ割合ぶんだけ下がる', () => {
    const half = applyGengaku(plan, 1 / 2, 12);
    assert.equal(half.monthly, Math.floor(plan.monthly / 2));
    assert.ok(half.monthlyDelta < 0);
  });

  test('延長月数 = 適用月数 × (1 - 減額割合)', () => {
    assert.equal(applyGengaku(plan, 1 / 2, 12).extraMonths, 6);
    assert.equal(applyGengaku(plan, 1 / 4, 12).extraMonths, 9);
    assert.equal(applyGengaku(plan, 2 / 3, 12).extraMonths, 4);
  });

  test('適用期間は通算15年（180か月）で頭打ちになる', () => {
    const r = applyGengaku(plan, 1 / 2, 999);
    assert.equal(r.monthsApplied, GENGAKU.maxTotalMonths);
  });

  test('信用情報には影響しない', () => {
    assert.equal(applyGengaku(plan, 1 / 2, 12).creditImpact, false);
  });
});

describe('返還期限猶予を適用した結果', () => {
  const plan = plan2shu(2_400_000, 2);

  test('月額はゼロになるが総額は変わらない（免除ではない）', () => {
    const r = applyYuyo(plan, 12);
    assert.equal(r.monthly, 0);
    assert.equal(r.repayTotalDelta, 0);
    assert.equal(r.extraCost, 0);
  });

  test('猶予した月数ぶん完済が後ろにずれる', () => {
    assert.equal(applyYuyo(plan, 12).count, plan.count + 12);
  });

  test('一般猶予は通算10年（120か月）で頭打ち', () => {
    assert.equal(applyYuyo(plan, 999).monthsDeferred, YUYO.maxTotalMonths);
  });
});

describe('繰上返還した結果', () => {
  test('第一種は無利子なので総額は変わらず期間だけ縮む', () => {
    const p = plan1shu(2_160_000);
    const r = applyKuriage(p, p.monthly * 10);
    assert.equal(r.repayTotalDelta, 0);
    assert.equal(r.extraMonths, -10);
  });

  test('第二種は将来利息が減り、総額が下がる', () => {
    const p = plan2shu(4_800_000, 3);
    const r = applyKuriage(p, 500_000);
    assert.ok(r.interestSaved > 0, '利息が減っていない');
    assert.ok(r.repayTotal < p.repayTotal);
    assert.ok(r.extraMonths < 0, '期間が縮んでいない');
  });

  test('繰上額が大きいほど利息の削減幅も大きい', () => {
    const p = plan2shu(4_800_000, 3);
    assert.ok(applyKuriage(p, 1_000_000).interestSaved > applyKuriage(p, 300_000).interestSaved);
  });

  test('繰上額ゼロなら何も変わらない', () => {
    const p = plan2shu(4_800_000, 3);
    const r = applyKuriage(p, 0);
    assert.equal(r.repayTotalDelta, 0);
    assert.equal(r.extraMonths, 0);
  });
});

describe('延滞した結果', () => {
  const plan = plan2shu(4_800_000, 3);

  test('延滞金が発生し、総額が増える（減額返還との決定的な違い）', () => {
    const r = applyEntai(plan, 12);
    assert.ok(r.extraCost > 0, '延滞金が発生していない');
    assert.ok(r.repayTotal > plan.repayTotal);
  });

  test('3か月で個人信用情報機関への登録対象になる', () => {
    assert.equal(applyEntai(plan, 2).creditImpact, false);
    assert.equal(applyEntai(plan, ENTAI.creditRegistrationMonths).creditImpact, true);
  });

  test('登録後の案内文に完済後5年の保持期間が入る', () => {
    assert.match(applyEntai(plan, 3).creditNote, /5年/);
  });

  test('延滞が長いほど延滞金は増える', () => {
    assert.ok(applyEntai(plan, 24).extraCost > applyEntai(plan, 6).extraCost);
  });

  test('延滞中は減額返還が使えなくなる', () => {
    assert.equal(applyEntai(plan, 3).blocksGengaku, true);
  });

  test('延滞ゼロか月なら延滞金もゼロ', () => {
    assert.equal(applyEntai(plan, 0).extraCost, 0);
  });

  test('一括請求のリスク額は返還未済額＋延滞金', () => {
    const r = applyEntai(plan, 12);
    assert.equal(r.lumpSumRisk, plan.repayTotal + r.extraCost);
  });

  test('延滞金そのものは未払い累計より小さい（金額だけで判断させない根拠）', () => {
    const r = applyEntai(plan, 12);
    assert.ok(r.extraCost < r.arrears);
    assert.ok(r.lumpSumRisk > r.arrears, '一括請求のほうが桁違いに大きいこと');
  });
});

// ------------------------------------------------------------ 所得連動返還方式

describe('所得連動返還方式の返還月額', () => {
  test('課税対象所得 × 9% ÷ 12（1円未満切り捨て）', () => {
    assert.equal(shotokuRendoMonthly(3_000_000), Math.floor(3_000_000 * 0.09 / 12));
  });

  test('子1人につき33万円を控除する', () => {
    assert.equal(shotokuRendoMonthly(3_000_000, 2), Math.floor((3_000_000 - 660_000) * 0.09 / 12));
  });

  test('下限は月2,000円', () => {
    assert.equal(shotokuRendoMonthly(0), 2_000);
    assert.equal(shotokuRendoMonthly(100_000), 2_000);
  });
});

// ---------------------------------------------------------------- 表示用

describe('表示用ヘルパー', () => {
  test('完済年月を返還開始と回数から出す', () => {
    assert.deepEqual(payoffDate(2026, 10, 12), { year: 2027, month: 9 });
    assert.deepEqual(payoffDate(2026, 10, 1), { year: 2026, month: 10 });
    assert.deepEqual(payoffDate(2026, 10, 240), { year: 2046, month: 9 });
  });

  test('期間の差分ラベル', () => {
    assert.equal(monthsLabel(0), '変わらない');
    assert.equal(monthsLabel(6), '+6か月');
    assert.equal(monthsLabel(12), '+1年');
    assert.equal(monthsLabel(18), '+1年6か月');
    assert.equal(monthsLabel(-9), '−9か月');
  });
});
