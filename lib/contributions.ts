import {type Profile} from './profile';
import {policyRows,type Source} from './policies';
export const contributionKeys=['pensionMonthly','medicalMonthly','unemploymentMonthly','injuryMonthly','maternityMonthly','fundMonthly','supplementMonthly'] as const;
const cents=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
/** Resolve a monthly employee scenario without overwriting the user's saved payroll corrections. */
export function resolveContributions(raw:Profile){
 const local=raw.city.trim().replace(/市$/,'')==='上海';
 const average=raw.annualSalary!==null&&raw.annualSalary>0?raw.annualSalary/12:null;
 const socialInput=raw.socialBase??average, fundInput=raw.fundBase??average;
 const socialBase=local&&socialInput!==null?cents(clamp(socialInput,7546,37731)):null;
 const fundBase=local&&fundInput!==null?cents(clamp(fundInput,2740,37731)):null;
 const status=!raw.automaticDeductions?'manual':!local?'unsupported':socialBase===null||fundBase===null?'missing':'ready';
 const profile={...raw};
 if(raw.automaticDeductions){
  profile.pensionMonthly=socialBase===null?0:cents(socialBase*.08);
  profile.medicalMonthly=socialBase===null?0:cents(socialBase*.02);
  profile.unemploymentMonthly=socialBase===null?0:cents(socialBase*.005);
  profile.injuryMonthly=0;profile.maternityMonthly=0;
  profile.fundMonthly=fundBase===null?0:Math.round(fundBase*raw.fundRate/100);
  profile.supplementMonthly=fundBase===null?0:Math.round(fundBase*raw.supplementRate/100);
 }
 return {profile,status,socialBase,fundBase,socialInput,fundInput,estimated:raw.socialBase===null||raw.fundBase===null};
}
export const contributionSources:Source[]=[...policyRows.map(r=>({title:r[0],url:r[4],effective:r[3]})),
 {title:'应届生首次参保基数：首月全月工资',url:'https://rsj.sh.gov.cn/tfkcx_17604/20240709/t0035_1425250.html',effective:'2024-07-09官方问答；基数上下限采用2026年标准'},
 {title:'公积金月缴存额取整规则',url:'https://zjw.sh.gov.cn/bmtishi/20210706/8c09e0673a41449da76dcdbb5b8a73cf.html',effective:'2021-07-06官方问答；仅引用计算到元规则，年度基数采用2026年表'}];
