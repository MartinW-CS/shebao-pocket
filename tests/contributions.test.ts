import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE,normalizeProfile} from '../lib/profile';
import {resolveContributions} from '../lib/contributions';
import {salarySummary} from '../lib/salary';
test('income changes update policy deductions and annual take home',()=>{
 const p=resolveContributions({...DEFAULT_PROFILE,annualSalary:120000}).profile;
 assert.equal(p.pensionMonthly,800);assert.equal(p.medicalMonthly,200);assert.equal(p.unemploymentMonthly,50);assert.equal(p.fundMonthly,700);
 assert.equal(salarySummary(p).net,97620);
 const next=resolveContributions({...DEFAULT_PROFILE,annualSalary:240000}).profile;
 assert.equal(next.pensionMonthly,1600);assert.equal(next.fundMonthly,1400);assert.equal(salarySummary(next).contributions,42000);
});
test('social and housing bases have independent floors and common cap',()=>{
 const low=resolveContributions({...DEFAULT_PROFILE,annualSalary:24000});
 assert.equal(low.socialBase,7546);assert.equal(low.fundBase,2740);assert.equal(low.profile.pensionMonthly,603.68);assert.equal(low.profile.fundMonthly,192);
 const high=resolveContributions({...DEFAULT_PROFILE,annualSalary:1200000});
 assert.equal(high.socialBase,37731);assert.equal(high.profile.fundMonthly,2641);
});
test('actual bases override salary and supplemental amount rounds separately',()=>{
 const result=resolveContributions({...DEFAULT_PROFILE,annualSalary:240000,socialBase:12000,fundBase:10010,fundRate:5,supplementRate:3});
 assert.equal(result.profile.pensionMonthly,960);assert.equal(result.profile.fundMonthly,501);assert.equal(result.profile.supplementMonthly,300);
});
test('manual payroll survives toggling and raw state is unchanged',()=>{
 const raw={...DEFAULT_PROFILE,annualSalary:240000,pensionMonthly:789};
 assert.equal(resolveContributions(raw).profile.pensionMonthly,1600);assert.equal(raw.pensionMonthly,789);
 assert.equal(resolveContributions({...raw,automaticDeductions:false}).profile.pensionMonthly,789);
});
test('missing income and unsupported cities never inherit default Shanghai sample amounts',()=>{
 assert.equal(resolveContributions(DEFAULT_PROFILE).status,'missing');assert.equal(resolveContributions(DEFAULT_PROFILE).profile.pensionMonthly,0);
 const other=resolveContributions({...DEFAULT_PROFILE,city:'北京',annualSalary:120000});
 assert.equal(other.status,'unsupported');assert.equal(other.profile.fundMonthly,0);
});
test('old local profiles migrate to automatic mode and policy rates remain valid',()=>{
 const old=normalizeProfile({annualSalary:120000,pensionMonthly:789,fundRate:12,supplementRate:20});
 assert.equal(old.automaticDeductions,true);assert.equal(old.pensionMonthly,789);assert.equal(old.fundRate,7);assert.equal(old.supplementRate,5);
 assert.equal(resolveContributions(old).profile.pensionMonthly,800);
});
