import type { Profile } from './profile';
import { accountEstimates, chinaMonth, contributionYears } from './profile';

export const retirementSources: { title: string; url: string; effective: string }[] = [
  {
    title: '全国人大常委会延迟退休决定及国务院办法',
    url: 'https://www.hmo.gov.cn/2026/08/21/ARTI6kpLUW6qilBUClmQ6bio260821.shtml',
    effective: '2025-01-01起；最低养老缴费年限2030年起逐年增加6个月',
  },
  {
    title: '上海企业基本养老金计发办法（沪人社规〔2026〕16号）',
    url: 'https://www.shanghai.gov.cn/gwk/search/content/t0035_1443100',
    effective: '2026-08-16至2031-08-15；原2021年办法已废止',
  },
  {
    title: '国家个人账户养老金计发月数表',
    url: 'https://fgk.chinatax.gov.cn/zcfgk/c102440/c5193739/content.html',
    effective: '国发〔2005〕38号；非整岁月份适用细节本次未核实',
  },
  {
    title: '人社部：弹性退休最低缴费年限如何确定',
    url: 'https://chinajob.mohrss.gov.cn/h5/c/2025-01-02/421886.shtml',
    effective: '2025-01-01起；提前按所选退休年，延迟按法定退休年',
  },
  {
    title: '上海医保局：退休医保待遇条件',
    url: 'https://ybj.sh.gov.cn/cb_jbdyl/20260629/3318d1479e9146c6bbafdac988f5737d.html',
    effective: '2026-06-29官方答复；原文为含视作缴费年限累计超过15年，需经办核定',
  },
];

const SHANGHAI_WAGE_SCENARIO = 12577;
const DIVISORS: Record<number, number> = {
  40:233,41:230,42:226,43:223,44:220,45:216,46:212,47:208,
  48:204,49:199,50:195,51:190,52:185,53:180,54:175,55:170,
  56:164,57:158,58:152,59:145,60:139,61:132,62:125,63:117,
  64:109,65:101,66:93,67:84,68:75,69:65,70:56,
};

// The cohort anchors are January births first affected on 2025-01-01.
const CATEGORIES = {
  male: { oldAgeMonths:720, cohortYear:1965, step:4, maximum:36 },
  female55: { oldAgeMonths:660, cohortYear:1970, step:4, maximum:36 },
  female50: { oldAgeMonths:600, cohortYear:1975, step:2, maximum:60 },
} as const;

export type RetirementResult = {
  /** Statutory retirement age, expressed as whole years and remaining months. */
  ageYears: number; ageMonths: number;
  retirementYear: number; retirementMonth: number;
  remainingYears: number; minYears: number; projectedYears: number;
  /** Contribution-duration screening only; not an administrative eligibility decision. */
  eligible: boolean;
  basic: number; personal: number|null; total: number|null;
  divisor: number|null; approximate: boolean; notes: string[];
};

// 2026 Shanghai rule: each pension component rounds upwards to the next jiao.
function ceilJiao(value: number): number {
  return Math.max(0, Math.ceil(value * 10 - 1e-8) / 10);
}

export function retirement(p: Profile, now = new Date()): RetirementResult {
  const current = chinaMonth(now);
  const currentSerial = current.year * 12 + current.month - 1;
  const notes: string[] = [];
  const parsed = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(p.birthMonth.trim());
  const explicitBirthSerial = parsed ? Number(parsed[1]) * 12 + Number(parsed[2]) - 1 : null;
  const validBirth = explicitBirthSerial !== null && Number(parsed![1]) >= 1900 && explicitBirthSerial <= currentSerial;
  const fallbackAge = Number.isFinite(p.age) ? Math.min(100, Math.max(16, p.age)) : 22;
  const birthSerial = validBirth ? explicitBirthSerial! : currentSerial - Math.round(fallbackAge * 12);
  if (!validBirth) notes.push('未填写有效出生年月：按当前上海月份及填写年龄近似推算，退休年月需补充出生年月后确认。');

  const category = CATEGORIES[p.retirementCategory] ?? CATEGORIES.male;
  const cohortOffset = birthSerial - category.cohortYear * 12;
  const delayedMonths = cohortOffset < 0 ? 0 : Math.min(category.maximum, Math.floor(cohortOffset / category.step) + 1);
  const statutoryAgeMonths = category.oldAgeMonths + delayedMonths;
  const ageYears = Math.floor(statutoryAgeMonths / 12);
  const ageMonths = statutoryAgeMonths % 12;
  const retirementSerial = birthSerial + statutoryAgeMonths;
  const retirementYear = Math.floor(retirementSerial / 12);
  const retirementMonth = retirementSerial % 12 + 1;
  const futureMonths = Math.max(0, retirementSerial - currentSerial);
  const remainingYears = futureMonths / 12;
  const minimumMonths = 180 + Math.min(60, Math.max(0, retirementYear - 2029) * 6);
  const minYears = minimumMonths / 12;
  const elapsedYears = Math.max(0, contributionYears(p, now).pension);
  const projectedMonths = elapsedYears * 12 + futureMonths;
  const projectedYears = Math.round(projectedMonths / 12 * 10000) / 10000;
  // Compare unrounded duration so display rounding cannot turn a shortfall into a pass.
  const eligible = projectedMonths + 1e-8 >= minimumMonths;

  const validOverride = p.divisorOverride !== null && Number.isFinite(p.divisorOverride) && p.divisorOverride > 0;
  const divisor = validOverride ? p.divisorOverride : ageMonths === 0 ? (DIVISORS[Math.min(70, ageYears)] ?? null) : null;
  if (validOverride) notes.push('个人账户计发月数采用你填写的值，请以社保经办核定值为准。');
  else if (p.divisorOverride !== null) notes.push('计发月数必须是大于0的有限数字，已忽略无效输入。');
  if (divisor === null) notes.push('非整岁退休的计发月数未核实，不按整岁取整或自行插值；填写经核定的计发月数后再计算个人账户养老金及合计。');

  const startingBalance = Math.max(0, accountEstimates(p, now).pension);
  const monthlyDeposit = Math.max(0, p.pensionMonthly);
  const validGrowth = Number.isFinite(p.accountGrowth) && p.accountGrowth > -100;
  const growth = validGrowth ? p.accountGrowth / 100 : 0;
  if (!validGrowth) notes.push('账户增长率输入无效，暂按0%情景计算。');
  // Monthly compounding and end-of-month deposits are an explicit scenario,
  // not the official annual bookkeeping process or a promised credited rate.
  const monthlyLogGrowth = Math.log1p(growth) / 12;
  const growthFactor = Math.exp(monthlyLogGrowth * futureMonths);
  const annuityFactor = Math.abs(monthlyLogGrowth) < 1e-12 ? futureMonths
    : Math.expm1(monthlyLogGrowth * futureMonths) / Math.expm1(monthlyLogGrowth);
  const projectedBalance = startingBalance * growthFactor + monthlyDeposit * annuityFactor;
  const salaryIndex = Number.isFinite(p.salaryIndex) && p.salaryIndex >= 0 ? p.salaryIndex : 1;
  const basic = ceilJiao(SHANGHAI_WAGE_SCENARIO * (1 + salaryIndex) / 2 * projectedYears * 0.01);
  const personal = divisor !== null && Number.isFinite(projectedBalance) ? ceilJiao(projectedBalance / divisor) : null;
  const total = personal === null ? null : Math.round((basic + personal) * 10) / 10;

  notes.push('养老金为情景估算：固定采用12,577元/月的当前上海参考工资作当前购买力参照，不是未来退休年度的官方计发标准。');
  notes.push('平均缴费指数为你填写的情景假设；未来假定逐月继续缴纳当前养老个人缴费，账户增长率按年百分比、月末缴入作简化模拟，不是官方记账利率或承诺收益。');
  if (p.pensionBalance === null) notes.push('未填写实际养老账户余额：当前余额仅按当前月养老个人缴费×已缴月数估算，未还原历史基数及利息。');
  if (p.pensionYears === null) notes.push('未填写实际养老缴费年限：暂按参加工作至今连续缴费推算；断缴和视同年限需自行校正。');
  if (!eligible) notes.push('到法定退休月的预计缴费年限不足，金额仅为公式试算，不能据此按月领取养老金；延缴或补缴须另按规定核定。');
  if (retirementSerial < currentSerial) notes.push('法定退休年月已过去；本工具不回溯重建当时账户和社平工资，也未判断是否已经退休。');
  if (retirementYear > 2031 || (retirementYear === 2031 && retirementMonth >= 8)) notes.push('现行上海养老金办法有效至2031-08-15，此后的结果假设公式延续，届时需按新政策复核。');
  if (p.city !== '上海') notes.push('当前养老金金额只提供上海参考情景，不能作为所填城市的待遇测算。');
  if (p.workYear <= 1992) notes.push('1992年底前参加工作可能有过渡性养老金，本次未计入，需结合历史档案另行核定。');
  notes.push('年限达标仅是初筛；还须核定原退休年龄类别、待遇领取地等。本结果按法定退休时间计算，未选择弹性提前或延迟退休。');
  notes.push('退休医保另行核定：上海医保局2026-06-29问答原文为含视作缴费年限累计超过15年；不把养老2030年起提高的门槛直接套给医保。');

  return {
    ageYears, ageMonths, retirementYear, retirementMonth, remainingYears,
    minYears, projectedYears, eligible, basic, personal, total, divisor,
    approximate: !validBirth || futureMonths > 0 || p.pensionBalance === null || p.pensionYears === null || divisor === null || p.city !== '上海',
    notes,
  };
}
