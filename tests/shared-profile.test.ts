import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROFILE,normalizeProfile,accountEstimates,contributionYears} from '../lib/profile';
import {resolveContributions} from '../lib/contributions';
import {retirement} from '../lib/retirement';
import {housing} from '../lib/housing';
const now=new Date('2026-10-23T12:00:00Z');
test('one overview profile drives pension, medical and fund calculations after reload',()=>{
 const previous=resolveContributions({...DEFAULT_PROFILE,annualSalary:120000,workYear:2026}).profile;
 const saved=JSON.stringify({profile:{...DEFAULT_PROFILE,annualSalary:240000,workYear:2024}});
 const next=resolveContributions(normalizeProfile(JSON.parse(saved).profile)).profile;
 assert.equal(next.pensionMonthly,1600);assert.equal(next.medicalMonthly,400);assert.equal(next.fundMonthly,1400);
 assert.equal(contributionYears(next,now).pension*12,28);
 assert.equal(accountEstimates(next,now).medical,11200);
 assert.equal(housing(next,now).balance,75600);
 assert.ok(retirement(next,now).personal!>retirement(previous,now).personal!);
 assert.equal(next.benefitWage,previous.benefitWage);assert.equal(next.injuryWage,previous.injuryWage);
});
test('syncing income preserves explicit actual balances and year overrides',()=>{
 const next=resolveContributions(normalizeProfile({...DEFAULT_PROFILE,annualSalary:240000,workYear:2024,pensionYears:1,medicalYears:2,fundYears:1.5,pensionBalance:12345,medicalBalance:2345,fundBalance:3456})).profile;
 assert.deepEqual(contributionYears(next,now),{pension:1,medical:2,fund:1.5});
 assert.deepEqual(accountEstimates(next,now),{pension:12345,medical:2345,fund:3456});
});
