/**
 * JASSO の制度パラメータと利率。
 *
 * このファイルだけを差し替えれば制度改正・利率改定に追随できる。
 * 数値には必ず出典URLと確認日を添えること。画面のフッターに表示される。
 */

export const DATA_CHECKED_ON = '2026-08-28';

export const SOURCES = {
  kappukin: {
    label: '返還期間と割賦金',
    url: 'https://www.jasso.go.jp/shogakukin/henkan/houhou/henkan_hoshiki/henkan_kikan/index.html',
  },
  henkanRei: {
    label: '大学・返還例',
    url: 'https://www.jasso.go.jp/shogakukin/henkan/houhou/henkan_hoshiki/kappu/sample/daigaku.html',
  },
  riritsu: {
    label: '第二種奨学金の利子と利率の算定方法',
    url: 'https://www.jasso.go.jp/shogakukin/about/taiyo/taiyo_2shu/riritsu_santei.html',
  },
  gengaku: {
    label: '減額返還制度の概要',
    url: 'https://www.jasso.go.jp/shogakukin/henkan_konnan/gengaku/seido.html',
  },
  gengakuMeyasu: {
    label: '減額返還制度の収入・所得金額の目安',
    url: 'https://www.jasso.go.jp/shogakukin/henkan_konnan/gengaku/meyasu.html',
  },
  yuyo: {
    label: '返還を待ってもらう（返還期限猶予）',
    url: 'https://www.jasso.go.jp/shogakukin/henkan_konnan/yuyo/index.html',
  },
  yuyoKeikon: {
    label: '経済困難（一般猶予の申請事由）',
    url: 'https://www.jasso.go.jp/shogakukin/henkan_konnan/yuyo/ippan/teishutusyo/keikon/',
  },
  entaikin: {
    label: '延滞金',
    url: 'https://www.jasso.go.jp/shogakukin/entai/entaikin.html',
  },
  shinyoJoho: {
    label: '個人信用情報機関への登録',
    url: 'https://www.jasso.go.jp/shogakukin/entai/kojinjoho/index.html',
  },
  shotokuRendo: {
    label: '所得連動返還方式の返還月額の算出',
    url: 'https://www.jasso.go.jp/shogakukin/henkan/houhou/henkan_hoshiki/shotokurendo/santei.html',
  },
  scholarPS: {
    label: 'スカラネット・パーソナル',
    url: 'https://www.jasso.go.jp/shogakukin/oyakudachi/sukara_ps/index.html',
  },
};

/**
 * 割賦金基礎額表。返還年数 = floor(貸与総額 / 基礎額)、返還回数 = 返還年数 × 12。
 * base が null の区分は「貸与総額の 1/20」＝ 一律20年（最長）。
 * 第一種・第二種で共通。
 */
export const KISOGAKU_TABLE = [
  { upTo:   200_000, base:  30_000 },
  { upTo:   400_000, base:  40_000 },
  { upTo:   500_000, base:  50_000 },
  { upTo:   600_000, base:  60_000 },
  { upTo:   700_000, base:  70_000 },
  { upTo:   900_000, base:  80_000 },
  { upTo: 1_100_000, base:  90_000 },
  { upTo: 1_300_000, base: 100_000 },
  { upTo: 1_500_000, base: 110_000 },
  { upTo: 1_700_000, base: 120_000 },
  { upTo: 1_900_000, base: 130_000 },
  { upTo: 2_100_000, base: 140_000 },
  { upTo: 2_300_000, base: 150_000 },
  { upTo: 2_500_000, base: 160_000 },
  { upTo: 3_400_000, base: 170_000 },
  { upTo: Infinity,  base: null },
];

export const MAX_RETURN_YEARS = 20;

/**
 * 第二種の利息計算に使う据置期間（か月）。
 *
 * 貸与終了（多くは3月）から返還開始（10月）までの間、返還はしないが利息は発生する。
 * JASSO は正確な計算式を公開していないため、公式「大学・返還例」48件に対して
 * 実測で較正した値を使う。test/calc.test.mjs が全件の誤差を検証している。
 * 較正結果: 48件中47件が誤差50円以内、最大誤差51円（返還総額1,162万円のケース）。
 */
export const DEFERMENT_MONTHS = 5.89;

/** 第二種の利率（年%）。毎月決定されるため定期的な更新が必要。 */
export const RATES_2SHU = {
  note: '貸与終了月に確定した利率が適用される。実際の値は返還予定表で確認すること。',
  cap: 3.0,
  fixed:  { label: '利率固定方式', latest: 3.000, latestMonth: '令和8年7月' },
  review: { label: '利率見直し方式', latest: 2.000, latestMonth: '令和8年7月', reviewIntervalYears: 5 },
  recent: [
    { month: '令和8年4月', fixed: 2.722, review: 1.874 },
    { month: '令和8年5月', fixed: 2.922, review: 2.000 },
    { month: '令和8年6月', fixed: 2.922, review: 1.900 },
    { month: '令和8年7月', fixed: 3.000, review: 2.000 },
  ],
};

/** 減額返還制度 */
export const GENGAKU = {
  /** 選べる減額割合。2024年4月に 2/3 と 1/4 が追加された。 */
  ratios: [
    { value: 2 / 3, label: '3分の2' },
    { value: 1 / 2, label: '2分の1' },
    { value: 1 / 3, label: '3分の1' },
    { value: 1 / 4, label: '4分の1' },
  ],
  /** 収入基準。給与所得者は「年間収入金額」、それ以外は「年間所得金額」。 */
  incomeLimits: {
    salaried: { base: 4_000_000, children2: 5_000_000, children3plus: 6_000_000 },
    other:    { base: 3_000_000, children2: 4_000_000, children3plus: 5_000_000 },
  },
  /** 被扶養者1人につき収入・所得金額から控除できる額 */
  dependentDeduction: 380_000,
  monthsPerApplication: 12,
  maxTotalMonths: 180, // 通算15年
  /** 返還予定総額も第二種の利子総額も変わらない（JASSO明記） */
  totalUnchanged: true,
  /** 願出・審査の時点で延滞していないことが条件 */
  requiresNoDelinquency: true,
  exclusions: [
    '所得連動返還方式を選択している第一種奨学生',
    '口座振替（リレー口座）に加入していない場合',
    '月賦返還以外（月賦半年賦併用返還など）',
  ],
};

/** 返還期限猶予（一般猶予・経済困難） */
export const YUYO = {
  incomeLimits: { salaried: 3_000_000, other: 2_000_000 },
  monthsPerApplication: 12,
  maxTotalMonths: 120, // 一般猶予は通算10年
  /** 災害・傷病・生活保護受給中などは通算年数の上限なし */
  unlimitedReasons: ['災害', '傷病', '生活保護受給中', '産前産後・育児休業'],
  /** 元金も利子も免除されない。返還終了年月が先送りされるだけ。 */
  forgivesNothing: true,
  /** 延滞中でも申請できる */
  availableWhileDelinquent: true,
};

/** 延滞 */
export const ENTAI = {
  /** 令和2年3月28日以降に発生する延滞金の賦課率（年・365日あたり） */
  annualRate: 0.03,
  rateNote: '令和2年3月27日以前に発生した分は年5%',
  /** 賦課対象は延滞した割賦金。第二種は利子を除く（＝元金部分）。 */
  baseExcludesInterest: true,
  /** 個人信用情報機関への登録基準 */
  creditRegistrationMonths: 3,
  creditRegistrationNote:
    '新たに返還を開始する人は、返還開始から6か月経過した時点で延滞3か月以上の場合が対象',
  /** 登録された情報は完済から5年後に削除される */
  creditRetentionYearsAfterPayoff: 5,
};

/** 所得連動返還方式（第一種のみ・平成29年度以降採用） */
export const SHOTOKU_RENDO = {
  rate: 0.09,
  childDeduction: 330_000,
  minMonthly: 2_000,
  note: '前年の課税対象所得に応じて毎年返還月額が変わるため、返還期間は定まらない',
};

/** 相談先（公的機関のみ。アフィリエイトは入れない） */
export const CONSULT = [
  {
    name: 'JASSO 奨学金相談センター',
    detail: '返還中の手続き・制度の相談窓口',
    url: 'https://www.jasso.go.jp/shogakukin/oyakudachi/toiawase/henkan.html',
  },
  {
    name: '法テラス（日本司法支援センター）',
    detail: '返済が立ち行かない場合の法律相談',
    url: 'https://www.houterasu.or.jp/',
  },
  {
    name: '日本クレジットカウンセリング協会',
    detail: '多重債務の無料カウンセリング',
    url: 'https://www.jcco.or.jp/',
  },
];
