import { accountEstimates, type Profile } from './profile';

export const housingSources = [
  { title: '上海2026年公积金贷款额度与套数认定', url: 'https://www.shanghai.gov.cn/xbhygq/20260228/87e93e4c373c4bfe81af5557a77d2e70.html', effective: '2026-02-26起，按贷款受理日适用' },
  { title: '连续缴存、余额倍数与还本能力限制', url: 'https://service.shanghai.gov.cn/XingZhengWenDangKuJyh/XZGFDetails.aspx?docid=REPORT_NDOC_008234', effective: '2022-01-01—2026-12-31；额度、套数、首付等已被后续文件修改' },
  { title: '上海市场租房提取操作细则', url: 'https://www.shzfgjj.cn/html/newxxgk/zcwj/gjjgwh/albpl/tq/224941.html', effective: '2024-11-01起；2024-10-31发布，官网标注有效' },
  { title: '租房每户4000元及新市民青年实际租金规则', url: 'https://service.shanghai.gov.cn/XingZhengWenDangKuJyh/XZGFDetails.aspx?docid=241015151102JbADRZpu6KkOIFz6TBv', effective: '2024-11-01起，有效期五年' },
  { title: '上海公积金缴存管理办法', url: 'https://www.shanghai.gov.cn/gwk/affairs/content/0064@03d6f8b173fb4927b9a475f0e764b9dd', effective: '2023-04-01起，有效期五年' },
  { title: '2026年购房提取与首付提取更新', url: 'https://www.shanghai.gov.cn/gwk/search/content/8dd3f23e760f44d79ce4ec99e298bd84', effective: '2026-08-21起；首付提取不影响贷款额度计算' },
];

const nonnegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Shanghai employee-contribution scenario, not an approval or a live account query. */
export function housing(p: Profile, now = new Date()) {
  const notes: string[] = [];
  const ownNormal = nonnegative(accountEstimates(p, now).fund);
  const ownSupplement = nonnegative(p.supplementBalance);
  const balance = cents(ownNormal + ownSupplement);
  const futureMonths = Math.max(0, Math.floor(nonnegative(p.projectionYears) * 12));
  const monthlyNormal = Math.round(nonnegative(p.fundMonthly)) * 2;
  const monthlySupplement = Math.round(nonnegative(p.supplementMonthly)) * 2;
  const projectedBalance = cents(balance + futureMonths * (monthlyNormal + monthlySupplement));

  notes.push(p.fundBalance === null
    ? '当前普通账户余额按工作时间、个人月缴额×2及已填提取额估算，包含单位部分；并非实账。补充余额单独使用填报值。'
    : '当前余额采用你填报的普通账户与补充账户余额，未连接公积金实账。');
  notes.push(`未来${futureMonths}个月假设单位与个人继续按现有相同比例缴存，未计利息、提取、调基或停缴；仅投影本人账户。`);

  if (p.city.trim() !== '上海') {
    return { balance, projectedBalance, loanLimit: null, balanceLimit: null, policyLimit: null, incomeLimit: null, purchaseLimit: null, eligible: null, rentWithdrawal: null,
      notes: [...notes, '此贷款与租房提取规则仅核验上海；当前城市尚未配置，不套用上海额度。'] };
  }

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  // The old document still supplies the unchanged 30/10 and 40% rules, but expires at 2026 year-end.
  const currentLoanRules = localDate >= '2026-02-26' && localDate <= '2026-12-31';
  const currentRentRules = localDate >= '2024-11-01' && localDate < '2029-11-01';
  const ownContinuous = nonnegative(p.continuousFundMonths);
  const ownQualifies = ownContinuous >= 6;
  const spouseParticipates = p.household === 'family' && p.spouseContinuousFundMonths >= 6 && p.loanConditionsConfirmed;
  const normalCapPerPerson = p.firstHome ? 1_000_000 : 800_000;
  const supplementCapPerPerson = 200_000;
  const ownSupplementActive = p.supplementMonthly > 0;
  const spouseSupplementActive = spouseParticipates && p.spouseSupplementMonthly > 0;

  const participants = spouseParticipates ? 2 : 1;
  const policyLimit = normalCapPerPerson * participants
    + supplementCapPerPerson * (Number(ownSupplementActive) + Number(spouseSupplementActive));
  const normalBalances = ownNormal + (spouseParticipates ? nonnegative(p.spouseFundBalance) : 0);
  const supplementaryBalances = (ownSupplementActive ? ownSupplement : 0)
    + (spouseSupplementActive ? nonnegative(p.spouseSupplementBalance) : 0);
  // Ordinary balances cannot fund the separate supplementary allowance, or vice versa.
  const balanceLimit = Math.min(normalBalances * 30, normalCapPerPerson * participants)
    + Math.min(supplementaryBalances * 10, supplementCapPerPerson * (Number(ownSupplementActive) + Number(spouseSupplementActive)));
  const loanMonths = Math.min(360, Math.floor(nonnegative(p.housingLoanYears) * 12));
  const incomeBase = nonnegative(p.incomeBase) + (spouseParticipates ? nonnegative(p.spouseIncomeBase) : 0);
  // A necessary principal-repayment ceiling, not an amortized payment affordability approval.
  const incomeLimit = incomeBase * 0.4 * loanMonths;
  const purchaseLimit = Math.max(0, nonnegative(p.housingPrice) - nonnegative(p.housingDownPayment));
  const eligible: boolean | null = !currentLoanRules ? null : !ownQualifies ? false : p.loanConditionsConfirmed ? true : null;
  const loanLimit = !currentLoanRules ? null : eligible === false ? 0
    : Math.floor(Math.min(balanceLimit, policyLimit, incomeLimit, purchaseLimit));

  if (!currentLoanRules) notes.push('该日期不在本模块已核验的贷款规则区间内；需核查后续政策，暂不输出贷款结论。');
  if (!ownQualifies) notes.push('普通职工申请时需账户正常且当前连续足额缴存满6个月；目前未通过此项初筛。补缴是否计连续需经办核验。');
  if (!p.loanConditionsConfirmed) notes.push('尚未确认全国未结清贷款、本市住房套数、信用、首付和期限等条件；显示额度仅为条件成立时的估算上界。');
  if (p.household === 'family' && !spouseParticipates) notes.push('配偶连续缴存满6个月且贷款条件确认后才计入配偶余额、收入及额度；当前按本人试算。');
  if (!ownSupplementActive && ownSupplement > 0) notes.push('你填报了补充账户余额，但当前补充缴存为0；为避免误判，本轮未计补充贷款额度，需经办核验。');
  notes.push('余额限额按普通30倍、补充10倍并分别受对应额度约束；个人首套普通100万、二套80万，正常缴补充最多另加20万。');
  notes.push('还款能力栏为月工资基数×40%×期数的本金必要上界。政策原文限制每月还本额，不能将其当作月本息40%公式或银行审批额度。');
  notes.push('房价限额只扣除已填首付款，尚须满足对应公积金最低首付；贷款期限最长30年，且不超过法定退休后5年，二手房还受房龄限制。');
  if (p.housingLoanYears > 30) notes.push('输入期限超过30年，试算已按30年封顶。');
  notes.push('本模块未自动适用多子女/绿色建筑上浮、异地或灵活就业贷款规则。首付专项提取不影响贷款额度，已发生该类提取时须填经办认可的计贷余额。');

  let rentWithdrawal: number | null = 0;
  if (!currentRentRules) {
    rentWithdrawal = null;
    notes.push('该日期不在本模块已核验的租赁提取规则有效期内。');
  } else if (!p.rentEligible || ownContinuous < 3) {
    notes.push('租房提取尚未满足确认条件：在沪连续缴存满3个月、夫妻无沪房、无公积金贷款及生效中还贷提取等；当前可提取测算为0。');
  } else {
    const rent = nonnegative(p.housingRent);
    const actualRentRoute = p.rentRegistered && (p.newCitizen || p.age <= 35);
    const available = Math.max(0, balance - 0.01);
    // No spouse rent account is inferred: spouse rent eligibility is not represented by this profile.
    rentWithdrawal = Math.floor((Math.min(rent, actualRentRoute ? rent : 4000, available) + 1e-8) * 100) / 100;
    notes.push(actualRentRoute
      ? '按已备案的新市民或35岁及以下青年路径估算已支付一个月租金的提取额；需租金税控发票并按单笔申请，不代表每月自动全额到账。'
      : '普通市场租赁按每户每月不超过实际房租及4000元测算，不是夫妻各4000元。');
    notes.push('租房试算仅使用本人已填余额并保留0.01元；补充账户可提取顺序、配偶共同提取及历史申请仍需经办核验。新市民指未获沪籍或获沪籍不满3年。');
  }

  return { balance, projectedBalance, loanLimit, balanceLimit: currentLoanRules ? Math.floor(balanceLimit) : null,
    policyLimit: currentLoanRules ? policyLimit : null, incomeLimit: currentLoanRules ? Math.floor(incomeLimit) : null,
    purchaseLimit: currentLoanRules ? cents(purchaseLimit) : null, eligible, rentWithdrawal, notes };
}
