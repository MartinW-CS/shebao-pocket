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

export function annualFromInput(value:number|null,period:Profile['incomePeriod']){
 return value===null?null:Math.round(value*(period==='monthly'?12:1)*100)/100;
}
export function displayedIncome(annual:number|null,period:Profile['incomePeriod']){
 return annual===null?null:Math.round(annual/(period==='monthly'?12:1)*100)/100;
}
/** Explain why a result is unavailable rather than using one generic loading label. */
export function incomeFeedback(p:Profile,deductionStatus:string){
 const result=salarySummary(p), fmt=(n:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(n);
 if(p.annualSalary!==null&&(!Number.isFinite(p.annualSalary)||p.annualSalary<=0||p.annualSalary>1e10))return {kind:'error',label:'请更正收入金额',message:'收入金额须大于0，且折合年薪不超过100亿元。请检查输入的数字及月薪 / 年薪单位。'};
 if(deductionStatus==='unsupported')return {kind:'notice',label:'当地政策待核验',message:'此城市的自动缴费规则尚未核验。请查询当地政策，或切换工资条校正后再计算。'};
 if(p.annualSalary===null)return {kind:'notice',label:'请填写月薪或年薪',message:deductionStatus==='ready'||deductionStatus==='manual'?'扣款已计算；只需补充税前月薪或年薪，即可估算到手收入，无需填完所有项目。':'只需填写税前月薪或年薪，并选择单位实际公积金比例；申报基数可留空自动估算。'};
 if(deductionStatus==='missing')return {kind:'notice',label:'请补充缴费基数',message:'收入已填写，但缴费基数尚不完整。请核对社保和公积金申报基数。'};
 if(result.status==='invalid')return {kind:'error',label:'请核对收入与扣款',message:`当前折合年薪为 ${fmt(p.annualSalary)} 元（平均每月 ${fmt(p.annualSalary/12)} 元），低于全年个人缴费 ${fmt(result.contributions)} 元，暂不能计算到手收入。${p.incomePeriod==='annual'?'如果填的是月薪，请切到“月薪”并重新输入原金额；单纯切换会自动换算，保持全年收入不变。':'请核对月薪、实际缴费基数或工资条校正金额。'} 年中入职按全年12个月缴费估算也可能不适用。`};
 return {kind:'success',label:'已计算',message:'已自动计算。月薪按12个月换算成年薪；切换输入单位不会改变全年收入或计算结果。'};
}
