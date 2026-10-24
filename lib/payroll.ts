import {type Profile} from './profile';
import {cumulativeTax,type Source,taxSource} from './policies';
export const PAYROLL_YEAR=2026;
const cents=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const cap=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export type PayrollRow={month:number;active:boolean;note:string;gross:number;pension:number;medical:number;unemployment:number;other:number;fund:number;supplement:number;contributions:number;tax:number;cumulativeTax:number;net:number;basic:number;extra:number;taxable:number;rate:number};
/** Single continuous employment scenario, wages received in their work month. Only verified 2026 rules. */
export function payroll(p:Profile){
 const rows:PayrollRow[]=[];
 const fail=(label:string,message:string,kind='error')=>({status:'invalid' as const,label,message,kind,rows:[] as PayrollRow[],gross:0,contributions:0,tax:0,net:0,monthlyNet:0,months:0});
 if(p.annualSalary===null)return fail('请填写月薪或年薪','填写一种收入即可计算；入职月份与公积金比例可按实际调整。','notice');
 if(!Number.isFinite(p.annualSalary)||p.annualSalary<=0||p.annualSalary>1e10)return fail('请更正收入金额','收入须大于0，折合年薪不超过100亿元。请核对月薪 / 年薪单位。');
 if(p.automaticDeductions&&p.city.trim().replace(/市$/,'')!=='上海')return fail('当地政策待核验','当地自动缴费规则尚未核验，请查询政策或改用工资条校正模式。','notice');
 if(!Number.isInteger(p.workMonth)||p.workMonth<1||p.workMonth>12||!Number.isInteger(p.workYear))return fail('请更正入职日期','参加工作年份须为整数，开始工作月份须为1—12月。');
 const start=Math.max(1,(p.workYear-PAYROLL_YEAR)*12+p.workMonth);
 if(start>12)return fail('本年尚未入职',`${p.workYear}年${p.workMonth}月才开始工作，2026年没有本次工作的工资月份。`,'notice');
 if(!Number.isInteger(p.payrollEndMonth)||p.payrollEndMonth<start||p.payrollEndMonth>12)return fail('请更正截止月份','测算截止月份须在本年入职月份之后或与其相同，且不超过12月。');
 if(!Number.isInteger(p.payrollTrialMonths)||p.payrollTrialMonths<0||p.payrollTrialMonths>6)return fail('请更正试用月数','试用月数须为0—6的整数；这里只用于工资情景，不判断合同期限是否合法。');
 if(p.payrollTrialMonths>0&&(p.payrollTrialSalary===null||!Number.isFinite(p.payrollTrialSalary)||p.payrollTrialSalary<=0))return fail('请填写试用期月薪','已设置试用期，请填写大于0的试用期整月税前工资，或将试用月数改为0。');
 if(p.payrollFirstSalary!==null&&(!Number.isFinite(p.payrollFirstSalary)||p.payrollFirstSalary<0))return fail('请更正首月工资','首月税前工资须为非负数；留空时按正常月薪或试用期月薪。');
 const normal=cents(p.annualSalary/12);
 let grossTotal=0,contribTotal=0,deductibleTotal=0,taxPaid=0,months=0;
 for(let month=1;month<=12;month++){
  const active=month>=start&&month<=p.payrollEndMonth;
  if(!active){rows.push({month,active,note:month<start?'尚未入职':'不在测算期间',gross:0,pension:0,medical:0,unemployment:0,other:0,fund:0,supplement:0,contributions:0,tax:0,cumulativeTax:taxPaid,net:0,basic:0,extra:0,taxable:0,rate:0});continue;}
  months++;
  const careerMonth=(PAYROLL_YEAR-p.workYear)*12+month-p.workMonth;
  const first=careerMonth===0,trial=careerMonth<p.payrollTrialMonths;
  const gross=cents(first&&p.payrollFirstSalary!==null?p.payrollFirstSalary:trial?p.payrollTrialSalary!:normal);
  // An incomplete first month's wage does not prorate social insurance. Explicit bases take priority.
  const social=cap(p.socialBase??normal,month<=6?7460:7546,month<=6?37302:37731);
  const fundBase=cap(p.fundBase??normal,month<=6?2690:2740,month<=6?37302:37731);
  const pension=p.automaticDeductions?cents(social*.08):p.pensionMonthly;
  const medical=p.automaticDeductions?cents(social*.02):p.medicalMonthly;
  const unemployment=p.automaticDeductions?cents(social*.005):p.unemploymentMonthly;
  const other=p.automaticDeductions?0:cents(p.injuryMonthly+p.maternityMonthly);
  const skipFund=first&&!p.fundFirstMonth;
  const fund=skipFund?0:p.automaticDeductions?Math.round(fundBase*p.fundRate/100):p.fundMonthly;
  const supplement=skipFund?0:p.automaticDeductions?Math.round(fundBase*p.supplementRate/100):p.supplementMonthly;
  const contributions=cents(pension+medical+unemployment+other+fund+supplement);
  if(gross<contributions)return fail('工资低于当月扣款',`${month}月税前工资 ${gross.toFixed(2)} 元，低于个人缴费 ${contributions.toFixed(2)} 元。请核对收入单位、首月工资和申报基数；此情况需结合单位工资条处理。`);
  grossTotal=cents(grossTotal+gross);contribTotal=cents(contribTotal+contributions);
  deductibleTotal=cents(deductibleTotal+contributions-other);
  const basic=5000*(p.firstJobTaxRelief&&p.workYear===PAYROLL_YEAR?month:months);
  // Annual field is a 12-month equivalent. Only amounts submitted for active employment months are modeled.
  const extra=cents(p.annualExtraDeduction/12*months);
  const taxResult=cumulativeTax(grossTotal,basic+deductibleTotal+extra,taxPaid);
  const tax=cents(taxResult.tax);taxPaid=cents(taxPaid+tax);
  rows.push({month,active,note:[first?'入职首月':trial?'试用期':'正常发薪',skipFund?'公积金次月起缴':'',first&&p.payrollFirstSalary!==null?'已校正工资':''].filter(Boolean).join(' · '),gross,pension,medical,unemployment,other,fund,supplement,contributions,tax,cumulativeTax:taxPaid,net:cents(gross-contributions-tax),basic,extra,taxable:cents(taxResult.taxable),rate:taxResult.rate});
 }
 const net=cents(grossTotal-contribTotal-taxPaid);
 return {status:'ready' as const,label:'已按入职月份计算',kind:'success',message:`2026年 ${start}—${p.payrollEndMonth} 月，共 ${months} 个工资月。已逐月计算缴费与累计预扣个税，修改资料后明细同步更新。`,rows,gross:grossTotal,contributions:contribTotal,tax:taxPaid,net,monthlyNet:cents(net/months),months};
}
export const payrollSources:Source[]=[
 {title:'2025年度社保基数：7,460—37,302元',url:'https://tyjr.sh.gov.cn/shtyjrswj/tzgg/20250919/557388ff0c4c4492ad11a3ae8863fb67.html',effective:'2025-07-01起；本表用于2026年1—6月'},
 {title:'2026年度社保基数：7,546—37,731元',url:'https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html',effective:'2026-07-01起'},
 {title:'2025年度公积金基数：2,690—37,302元',url:'https://www.shzfgjj.cn/html/newxxgk/zcjd/228183.html',effective:'2025-07—2026-06'},
 {title:'2026年度公积金基数及比例表',url:'https://www.shzfgjj.cn/html/jcjsllb/40204.html',effective:'2026-07—2027-06'},
 {title:'首次参加工作公积金次月起缴（第十六条）',url:'https://www.shanghai.gov.cn/gwk/affairs/content/0064@03d6f8b173fb4927b9a475f0e764b9dd',effective:'2023-04-01起，有效期5年'},
 {title:'工资薪金累计预扣法',url:taxSource,effective:'2019-01-01起'},
 {title:'首次取得工资的累计减除规则（2020年第13号）',url:'https://shanxi.chinatax.gov.cn/web/detail/sx-11400-548-1717516',effective:'2020-07-01起；须符合首次取得工资条件'},
];
