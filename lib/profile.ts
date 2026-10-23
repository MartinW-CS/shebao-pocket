export type Profile = {
  annualSalary:number|null; annualExtraDeduction:number;
  birthContinuous:number; birthPaid:boolean; medicalActive:boolean; taxIncome:number; taxMonths:number; taxSocial:number; taxExtra:number; taxPaid:number;
  city: string; age: number; birthMonth: string; retirementCategory: 'male'|'female55'|'female50';
  workYear: number; workMonth: number; pensionYears: number|null; medicalYears: number|null; fundYears: number|null;
  pensionMonthly: number; medicalMonthly: number; unemploymentMonthly: number; injuryMonthly: number; maternityMonthly: number;
  fundMonthly: number; fundRate: number; supplementMonthly: number; employerUnemploymentRate: number|null; employerInjuryRate: number;
  pensionBalance: number|null; medicalBalance: number|null; fundBalance: number|null; supplementBalance: number;
  medicalSpending: number; fundWithdrawn: number; salaryIndex: number; accountGrowth: number; divisorOverride: number|null;
  projectionYears: number; flexBase: number; flexPension: boolean; flexMedical: boolean;
  housingRent: number; housingPrice: number; housingDownPayment: number; housingLoanYears: number;
  household: 'single'|'family'; firstHome: boolean; continuousFundMonths: number; incomeBase: number;
  spouseFundBalance: number; spouseSupplementBalance: number; spouseContinuousFundMonths:number; spouseIncomeBase:number; spouseSupplementMonthly:number;
  rentEligible:boolean; loanConditionsConfirmed:boolean; newCitizen: boolean; rentRegistered: boolean;
  benefitWage: number; unemploymentContributionMonths: number|null; usedUnemploymentMonths: number;
  departureReason: 'voluntary'|'involuntary'; employmentRegistered: boolean;
  difficultBirth: boolean; babyCount: number; birthDate: string; birthMode: 'employee'|'flex'; birthInsuredMonths: number;
  hospitalCost: number; coveredHospitalCost: number; injuryGrade: number; injuryWage: number; contractEnded: boolean;
  gapMonths: number; hukou: 'local'|'nonlocal'; housingZone: 'inner'|'outer'; settlementRoute: 'residence'|'other';
};

export const DEFAULT_PROFILE: Profile = {
  annualSalary:null, annualExtraDeduction:0,
  birthContinuous:0,birthPaid:false,medicalActive:false,taxIncome:10000,taxMonths:1,taxSocial:1750,taxExtra:0,taxPaid:0,
  city:'上海', age:22, birthMonth:'2004-07', retirementCategory:'male', workYear:2026,workMonth:7,
  pensionYears:null,medicalYears:null,fundYears:null,
  pensionMonthly:800,medicalMonthly:200,unemploymentMonthly:50,injuryMonthly:0,maternityMonthly:0,
  fundMonthly:700,fundRate:7,supplementMonthly:0,employerUnemploymentRate:null,employerInjuryRate:0.2,
  pensionBalance:null,medicalBalance:null,fundBalance:null,supplementBalance:0,medicalSpending:0,fundWithdrawn:0,
  salaryIndex:1,accountGrowth:0,divisorOverride:null,projectionYears:5,flexBase:7546,flexPension:true,flexMedical:true,
  housingRent:3500,housingPrice:3000000,housingDownPayment:900000,housingLoanYears:30,household:'single',firstHome:true,
  continuousFundMonths:3,incomeBase:10000,spouseFundBalance:0,spouseSupplementBalance:0,spouseContinuousFundMonths:0,spouseIncomeBase:0,spouseSupplementMonthly:0,rentEligible:false,loanConditionsConfirmed:false,newCitizen:true,rentRegistered:false,
  benefitWage:10000,unemploymentContributionMonths:null,usedUnemploymentMonths:0,departureReason:'involuntary',employmentRegistered:false,
  difficultBirth:false,babyCount:1,birthDate:'2026-10-22',birthMode:'employee',birthInsuredMonths:4,hospitalCost:12000,coveredHospitalCost:10000,
  injuryGrade:10,injuryWage:10000,contractEnded:false,gapMonths:1,hukou:'nonlocal',housingZone:'inner',settlementRoute:'residence',
};

export function chinaMonth(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(now);
  return {year:Number(parts.find(p=>p.type==='year')?.value),month:Number(parts.find(p=>p.type==='month')?.value)};
}
export function automaticMonths(p:Profile,now=new Date()) {
  const {year,month}=chinaMonth(now); return Math.max(0,(year-p.workYear)*12+month-p.workMonth+1);
}
export function contributionYears(p:Profile,now=new Date()) {
  const months=automaticMonths(p,now);
  return {pension:p.pensionYears??months/12,medical:p.medicalYears??months/12,fund:p.fundYears??Math.max(0,months-1)/12};
}
export function normalizeProfile(raw:unknown):Profile {
  if(!raw||typeof raw!=='object') return {...DEFAULT_PROFILE};
  const result={...DEFAULT_PROFILE};
  for(const key of Object.keys(result) as (keyof Profile)[]) {
    const v=(raw as Record<string,unknown>)[key]; const fallback=DEFAULT_PROFILE[key];
    if(v===null&&fallback===null) (result as any)[key]=null;
    else if(typeof fallback==='number'||fallback===null) {if(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e10)(result as any)[key]=v;}
    else if(typeof v===typeof fallback) (result as any)[key]=v;
  }
  result.city=result.city.trim().slice(0,20)||'上海';
  if(!['male','female55','female50'].includes(result.retirementCategory))result.retirementCategory='male';
  result.age=Math.min(100,Math.max(16,result.age));
  result.workMonth=Math.min(12,Math.max(1,Math.round(result.workMonth)));
  result.workYear=Math.min(2100,Math.max(1950,Math.round(result.workYear)));
  result.fundRate=Math.min(12,Math.max(1,result.fundRate));
  for(const k of ['pensionYears','medicalYears','fundYears'] as const) if(result[k]!==null)result[k]=Math.min(80,result[k]!);
  result.projectionYears=Math.min(80,result.projectionYears);
  result.babyCount=Math.min(10,Math.max(1,Math.floor(result.babyCount)));
  result.accountGrowth=Math.min(100,result.accountGrowth);
  result.taxMonths=Math.min(12,Math.floor(result.taxMonths));
  result.injuryGrade=Math.min(10,Math.max(1,Math.round(result.injuryGrade)));
  return result;
}
export function accountEstimates(p:Profile,now=new Date()) {
  const y=contributionYears(p,now);
  return {
    pension:p.pensionBalance??Math.max(0,y.pension*12*p.pensionMonthly),
    medical:p.medicalBalance??Math.max(0,y.medical*12*p.medicalMonthly-p.medicalSpending),
    fund:p.fundBalance??Math.max(0,y.fund*12*p.fundMonthly*2-p.fundWithdrawn),
  };
}
export function contributionCosts(p:Profile) {
  const employee=p.pensionMonthly+p.medicalMonthly+p.unemploymentMonthly+p.injuryMonthly+p.maternityMonthly;
  const pensionBase=p.pensionMonthly/0.08, medicalBase=p.medicalMonthly/0.02;
  const knownEmployer=pensionBase*0.16+medicalBase*0.09+pensionBase*p.employerInjuryRate/100;
  const employer=knownEmployer+(p.employerUnemploymentRate===null?0:pensionBase*p.employerUnemploymentRate/100);
  return {employee,employer,employerComplete:p.employerUnemploymentRate!==null,pensionBase,medicalBase,total:employee+employer,personalFund:p.fundMonthly+p.supplementMonthly};
}
