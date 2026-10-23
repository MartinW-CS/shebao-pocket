import {contributionCosts,type Profile} from './profile';
import {cumulativeTax} from './policies';
/** Full-year resident salary scenario; monthly cash deductions need not equal allowable tax deductions. */
export function salarySummary(p:Profile){
 const c=contributionCosts(p);const contributions=(c.employee+c.personalFund)*12;
 if(p.annualSalary===null)return {status:'empty' as const,contributions,tax:null,net:null,monthlyNet:null};
 if(!Number.isFinite(p.annualSalary)||p.annualSalary<contributions)return {status:'invalid' as const,contributions,tax:null,net:null,monthlyNet:null};
 // Personal injury/maternity amounts, if entered for investigation, reduce cash but are not presumed tax-deductible.
 const deductible=(p.pensionMonthly+p.medicalMonthly+p.unemploymentMonthly+c.personalFund)*12;
 const tax=Math.round(cumulativeTax(p.annualSalary,60000+deductible+p.annualExtraDeduction,0).tax*100)/100;
 const net=Math.round((p.annualSalary-contributions-tax)*100)/100;
 return {status:'ready' as const,contributions,tax,net,monthlyNet:net/12};
}
