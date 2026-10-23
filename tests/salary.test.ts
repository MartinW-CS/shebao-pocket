import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE as p,normalizeProfile} from '../lib/profile';
import {salarySummary} from '../lib/salary';
test('missing salary remains empty and old saved profiles migrate without inventing a salary',()=>{assert.equal(salarySummary(p).net,null);assert.equal(normalizeProfile({city:'上海'}).annualSalary,null)});
test('120000 annual salary with 1750 monthly contributions produces 97620 net',()=>{const r=salarySummary({...p,annualSalary:120000});assert.equal(r.contributions,21000);assert.equal(r.tax,1380);assert.equal(r.net,97620);assert.equal(r.monthlyNet,8135)});
test('annual additional deductions reduce taxable salary, not cash contributions',()=>{const r=salarySummary({...p,annualSalary:120000,annualExtraDeduction:18000});assert.equal(r.tax,630);assert.equal(r.net,98370)});
test('salary changes update tax bracket and take-home estimate',()=>{const r=salarySummary({...p,annualSalary:240000});assert.equal(r.tax,14880);assert.equal(r.net,204120)});
test('deductions above salary request correction; zero valid income remains zero',()=>{assert.equal(salarySummary({...p,annualSalary:1000}).status,'invalid');assert.equal(salarySummary({...p,annualSalary:0,pensionMonthly:0,medicalMonthly:0,unemploymentMonthly:0,fundMonthly:0}).net,0)});
