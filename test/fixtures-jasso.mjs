// JASSO 公式「大学・返還例」の全件。
// 出典: https://www.jasso.go.jp/shogakukin/henkan/houhou/henkan_hoshiki/kappu/sample/daigaku.html
// 確認日: 2026-08-28
//
// このファイルは計算エンジンの正解データ。手で編集しないこと。
// 公式ページの表が更新されたら、表ごと差し替える。

/** 第一種（無利子・定額返還方式） */
export const DAI1 = [
  // { 貸与月額, 貸与月数, 貸与総額, 返還月額, 返還回数 }
  { monthly:  45_000, months: 48, total: 2_160_000, payment: 12_857, count: 168 },
  { monthly:  51_000, months: 48, total: 2_448_000, payment: 13_600, count: 180 },
  { monthly:  54_000, months: 48, total: 2_592_000, payment: 14_400, count: 180 },
  { monthly:  64_000, months: 48, total: 3_072_000, payment: 14_222, count: 216 },
  { monthly:  30_000, months: 48, total: 1_440_000, payment:  9_230, count: 156 },
  { monthly:  45_000, months: 72, total: 3_240_000, payment: 14_210, count: 228 },
  { monthly:  51_000, months: 72, total: 3_672_000, payment: 15_300, count: 240 },
  { monthly:  54_000, months: 72, total: 3_888_000, payment: 16_200, count: 240 },
  { monthly:  64_000, months: 72, total: 4_608_000, payment: 19_200, count: 240 },
  { monthly:  30_000, months: 72, total: 2_160_000, payment: 12_857, count: 168 },
];

/** 第二種（有利子・元利均等返還） */
export const DAI2 = [
  // { 貸与総額, 年利(%), 返還総額, 返還月額, 返還回数 }
  // --- 4年制（48か月） ---
  { total: 1_440_000, rate: 0.5, repayTotal: 1_491_061, payment:  9_557, count: 156 },
  { total: 1_440_000, rate: 1.0, repayTotal: 1_543_214, payment:  9_892, count: 156 },
  { total: 1_440_000, rate: 2.0, repayTotal: 1_650_545, payment: 10_580, count: 156 },
  { total: 1_440_000, rate: 3.0, repayTotal: 1_761_917, payment: 11_293, count: 156 },
  { total: 2_400_000, rate: 0.5, repayTotal: 2_497_419, payment: 13_874, count: 180 },
  { total: 2_400_000, rate: 1.0, repayTotal: 2_597_188, payment: 14_428, count: 180 },
  { total: 2_400_000, rate: 2.0, repayTotal: 2_803_404, payment: 15_574, count: 180 },
  { total: 2_400_000, rate: 3.0, repayTotal: 3_018_568, payment: 16_769, count: 180 },
  { total: 3_840_000, rate: 0.5, repayTotal: 4_045_295, payment: 16_855, count: 240 },
  { total: 3_840_000, rate: 1.0, repayTotal: 4_257_117, payment: 17_737, count: 240 },
  { total: 3_840_000, rate: 2.0, repayTotal: 4_699_817, payment: 19_582, count: 240 },
  { total: 3_840_000, rate: 3.0, repayTotal: 5_167_586, payment: 21_531, count: 240 },
  { total: 4_800_000, rate: 0.5, repayTotal: 5_056_654, payment: 21_069, count: 240 },
  { total: 4_800_000, rate: 1.0, repayTotal: 5_321_420, payment: 22_172, count: 240 },
  { total: 4_800_000, rate: 2.0, repayTotal: 5_874_754, payment: 24_478, count: 240 },
  { total: 4_800_000, rate: 3.0, repayTotal: 6_459_510, payment: 26_914, count: 240 },
  { total: 5_760_000, rate: 0.5, repayTotal: 6_068_011, payment: 25_282, count: 240 },
  { total: 5_760_000, rate: 1.0, repayTotal: 6_385_730, payment: 26_606, count: 240 },
  { total: 5_760_000, rate: 2.0, repayTotal: 7_049_746, payment: 29_373, count: 240 },
  { total: 5_760_000, rate: 3.0, repayTotal: 7_751_445, payment: 32_297, count: 240 },
  // --- 5年制（60か月） ---
  { total: 1_800_000, rate: 0.5, repayTotal: 1_863_847, payment: 11_947, count: 156 },
  { total: 1_800_000, rate: 1.0, repayTotal: 1_929_031, payment: 12_365, count: 156 },
  { total: 1_800_000, rate: 2.0, repayTotal: 2_063_211, payment: 13_225, count: 156 },
  { total: 1_800_000, rate: 3.0, repayTotal: 2_202_404, payment: 14_117, count: 156 },
  { total: 3_000_000, rate: 0.5, repayTotal: 3_137_193, payment: 15_378, count: 204 },
  { total: 3_000_000, rate: 1.0, repayTotal: 3_278_076, payment: 16_069, count: 204 },
  { total: 3_000_000, rate: 2.0, repayTotal: 3_570_658, payment: 17_503, count: 204 },
  { total: 3_000_000, rate: 3.0, repayTotal: 3_877_457, payment: 19_007, count: 204 },
  { total: 6_000_000, rate: 0.5, repayTotal: 6_320_843, payment: 26_337, count: 240 },
  { total: 6_000_000, rate: 1.0, repayTotal: 6_651_796, payment: 27_715, count: 240 },
  { total: 6_000_000, rate: 2.0, repayTotal: 7_343_509, payment: 30_597, count: 240 },
  { total: 6_000_000, rate: 3.0, repayTotal: 8_074_435, payment: 33_642, count: 240 },
  { total: 7_200_000, rate: 0.5, repayTotal: 7_585_038, payment: 31_604, count: 240 },
  { total: 7_200_000, rate: 1.0, repayTotal: 7_982_178, payment: 33_259, count: 240 },
  { total: 7_200_000, rate: 2.0, repayTotal: 8_812_212, payment: 36_717, count: 240 },
  { total: 7_200_000, rate: 3.0, repayTotal: 9_689_270, payment: 40_372, count: 240 },
  // --- 6年制（72か月） ---
  { total: 2_160_000, rate: 0.5, repayTotal: 2_242_140, payment: 13_346, count: 168 },
  { total: 2_160_000, rate: 1.0, repayTotal: 2_326_140, payment: 13_846, count: 168 },
  { total: 2_160_000, rate: 2.0, repayTotal: 2_499_401, payment: 14_877, count: 168 },
  { total: 2_160_000, rate: 3.0, repayTotal: 2_679_629, payment: 15_950, count: 168 },
  { total: 3_600_000, rate: 0.5, repayTotal: 3_792_460, payment: 15_801, count: 240 },
  { total: 3_600_000, rate: 1.0, repayTotal: 3_991_019, payment: 16_629, count: 240 },
  { total: 3_600_000, rate: 2.0, repayTotal: 4_406_055, payment: 18_358, count: 240 },
  { total: 3_600_000, rate: 3.0, repayTotal: 4_844_592, payment: 20_185, count: 240 },
  { total: 8_640_000, rate: 0.5, repayTotal: 9_102_066, payment: 37_925, count: 240 },
  { total: 8_640_000, rate: 1.0, repayTotal: 9_578_649, payment: 39_910, count: 240 },
  { total: 8_640_000, rate: 2.0, repayTotal: 10_574_652, payment: 44_061, count: 240 },
  { total: 8_640_000, rate: 3.0, repayTotal: 11_627_154, payment: 48_446, count: 240 },
];
