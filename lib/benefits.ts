import {contributionYears, type Profile} from './profile';
export const benefitSources = [
 {title:'上海失业保险金申领发放实施办法',url:'https://rsj.sh.gov.cn/tshbx_17729/20260812/t0035_1443067.html',effective:'2026-08-16—2031-08-15'},
 {title:'2026失业保险金标准',url:'https://rsj.sh.gov.cn/tshbx_17729/20260702/t0035_1442080.html',effective:'2026-07-01—2028-06-30；后续调标优先'},
 {title:'领取失业金期间的职工医保与生育保障',url:'https://shanghai.chinatax.gov.cn/tax/zcfw/zcfgk/sbf/202601/t479015.html',effective:'2026-03-01—2031-02-28'},
 {title:'2026生育津贴支付办法',url:'https://www.shanghai.gov.cn/gwk/search/content/79e981546eaf4727ae47502f4de955b8',effective:'2026-07-01—2027-06-30'},
 {title:'2026生育医疗保障新规',url:'https://www.shanghai.gov.cn/gwk/search/content/61adb44f0c7e4a2fbbb0d20d4fedbb25',effective:'2026-10-01—2031-09-30；旧4500元现金补贴规则废止'},
 {title:'灵活就业生育津贴问答',url:'https://ybj.sh.gov.cn/ybdt/20260910/0e7da8e7fb78401f80443347f93d8716.html',effective:'2025-01-01起；2026-09-10答复'},
 {title:'灵活就业生育津贴新条件',url:'https://www.shanghai.gov.cn/gwk/search/content/32736f1f6d904827936fe8f6de939628',effective:'2027-05-01起；此前按过渡规定'},
 {title:'上海工伤保险实施办法（待遇条款）',url:'https://www.shanghai.gov.cn/rcjysj/20250606/41aabf797ce34d2ca597cc47d046a50d.html',effective:'2013-01-01起；历年金额按新规覆盖'},
 {title:'2026工伤伤残津贴及护理费调整',url:'https://rsj.sh.gov.cn/tshbx_17729/20260929/t0035_1443999.html',effective:'2026-09-04—2028-09-03；待遇追溯2026-01-01'},
];
export function unemployment(p:Profile,now=new Date()){
 const contributed=p.unemploymentContributionMonths??Math.floor(contributionYears(p,now).pension*12);
 // This input represents contributions not already consumed by a previous award.
 const months=Math.min(24,Math.floor(contributed/12)*2);
 const eligible=p.departureReason==='involuntary'&&p.employmentRegistered&&months>0;
 return {months,eligible,firstMonthly:2340,laterMonthly:1872,total:Math.min(12,months)*2340+Math.max(0,months-12)*1872,
 notes:['按尚未用于核定待遇的缴费月数，每满12个月核2个月、最多24个月。曾领取或转入的，以经办核定剩余月数为准。','领取需满足非本人意愿中断就业、缴费满1年、在沪失业登记且有求职要求，以及最后参保地或户籍地等条件；本页仅作初筛。','普通主动辞职不满足条件；欠薪等依法解除情形须按事实核定。领金期间医保（含生育）由失业保险基金缴纳，不从失业金扣除。','金额按2026现行标准固定模拟；跨年可能调标。期满距法定退休不足1年等延领情形另行核定。']};
}
export const injuryMultipliers=[27,25,23,21,18,16,13,11,9,7];
export const injuryGrantMultipliers=[0,0,0,0,18,15,12,9,6,3];
export function injury(p:Profile){
 const i=p.injuryGrade-1; const monthly=i<4?Math.max(p.injuryWage*[.9,.85,.8,.75][i],[9468,8818,8288,7745][i]):i<6?p.injuryWage*[.7,.6][i-4]:0;
 return {oneOff:p.injuryWage*injuryMultipliers[i],monthly,grantMonths:injuryGrantMultipliers[i]};
}
export function maternity(p:Profile,continuousMonths:number,paid:boolean,medicalActive:boolean){
 const days=158+(p.difficultBirth?15:0)+(Math.max(1,Math.floor(p.babyCount))-1)*15;
 const current=p.birthDate>='2026-07-01'&&p.birthDate<='2027-06-30';
 const base=p.birthMode==='flex'?12577*.6:Math.min(37731,Math.max(12577*.6,p.benefitWage));
 const total=base/30*days;
 const full=p.birthInsuredMonths>=12||continuousMonths>=9;
 const eligible=paid&&(p.birthMode==='employee'||(p.birthInsuredMonths>=12&&(p.birthDate<'2027-05-01'||medicalActive)));
 const ratio=p.birthMode==='flex'?1:full?1:Math.min(1,p.birthInsuredMonths/12);
 const medicalEligible=medicalActive&&p.birthDate>='2026-10-01'&&p.birthDate<='2031-09-30';
 const covered=medicalEligible?Math.min(p.hospitalCost,p.coveredHospitalCost):null;
 return {days,eligible,current,base,total:current&&eligible?total:null,fund:current&&eligible?total*ratio:null,advance:current&&eligible?total*(1-ratio):null,covered,outOfPocket:covered===null?null:Math.max(0,p.hospitalCost-covered)};
}
