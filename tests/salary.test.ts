import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE as p,normalizeProfile} from '../lib/profile';
import {salarySummary} from '../lib/salary';
test('missing salary remains empty and old saved profiles migrate without inventing a salary',()=>{assert.equal(salarySummary(p).net,null);assert.equal(normalizeProfile({city:'上海'}).annualSalary,null)});
test('120000 annual salary with 1750 monthly contributions produces 97620 net',()=>{const r=salarySummary({...p,annualSalary:120000});assert.equal(r.contributions,21000);assert.equal(r.tax,1380);assert.equal(r.net,97620);assert.equal(r.monthlyNet,8135)});
test('annual additional deductions reduce taxable salary, not cash contributions',()=>{const r=salarySummary({...p,annualSalary:120000,annualExtraDeduction:18000});assert.equal(r.tax,630);assert.equal(r.net,98370)});
test('salary changes update tax bracket and take-home estimate',()=>{const r=salarySummary({...p,annualSalary:240000});assert.equal(r.tax,14880);assert.equal(r.net,204120)});
test('deductions above salary request correction; zero valid income remains zero',()=>{assert.equal(salarySummary({...p,annualSalary:1000}).status,'invalid');assert.equal(salarySummary({...p,annualSalary:0,pensionMonthly:0,medicalMonthly:0,unemploymentMonthly:0,fundMonthly:0}).net,0)});

test('monthly and annual entry produce identical salary and contribution results',async()=>{
 const {annualFromInput,displayedIncome}=await import('../lib/salary');
 const {resolveContributions}=await import('../lib/contributions');
 const monthly=annualFromInput(16000,'monthly'),annual=annualFromInput(192000,'annual');
 assert.equal(monthly,192000);assert.equal(monthly,annual);
 assert.equal(displayedIncome(monthly,'annual'),192000);assert.equal(displayedIncome(annual,'monthly'),16000);
 assert.deepEqual(salarySummary(resolveContributions({...p,annualSalary:monthly}).profile),salarySummary(resolveContributions({...p,annualSalary:annual}).profile));
 assert.equal(annualFromInput(1234.56,'monthly'),14814.72);assert.equal(displayedIncome(14814.72,'monthly'),1234.56);
 assert.equal(annualFromInput(null,'monthly'),null);assert.equal(displayedIncome(null,'annual'),null);
});
test('legacy annual input keeps its meaning and monthly preference survives reload',()=>{
 assert.equal(normalizeProfile({annualSalary:16000}).incomePeriod,'annual');
 const saved=normalizeProfile({annualSalary:192000,incomePeriod:'monthly'});
 assert.equal(saved.incomePeriod,'monthly');assert.equal(saved.annualSalary,192000);
});
test('wrong-unit scenario explains the conflicting numbers, not waiting for input',async()=>{
 const {incomeFeedback}=await import('../lib/salary');
 const {resolveContributions}=await import('../lib/contributions');
 const deductions=resolveContributions({...p,annualSalary:16000,incomePeriod:'annual',socialBase:16000,fundRate:5});
 const message=incomeFeedback(deductions.profile,deductions.status);
 assert.equal(message.kind,'error');assert.equal(message.label,'请核对收入与扣款');
 assert.match(message.message,/16,000/);assert.match(message.message,/21,804/);assert.match(message.message,/重新输入原金额/);assert.doesNotMatch(message.message,/等待填写/);
 const corrected=resolveContributions({...deductions.profile,annualSalary:192000,incomePeriod:'monthly'});
 assert.equal(incomeFeedback(corrected.profile,corrected.status).kind,'success');
});
test('empty, invalid and unavailable policy states have distinct explanations',async()=>{
 const {incomeFeedback}=await import('../lib/salary');
 assert.equal(incomeFeedback(p,'missing').label,'请填写月薪或年薪');
 for(const annualSalary of [0,-1,Infinity,NaN,1e11])assert.equal(incomeFeedback({...p,annualSalary},'ready').label,'请更正收入金额');
 assert.equal(incomeFeedback({...p,annualSalary:192000},'unsupported').label,'当地政策待核验');
});
