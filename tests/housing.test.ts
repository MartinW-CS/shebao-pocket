import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE } from '../lib/profile';
import { housing } from '../lib/housing';

const now = new Date('2026-10-22T12:00:00+08:00');
const ready = { ...DEFAULT_PROFILE, fundBalance: 100_000, continuousFundMonths: 12, loanConditionsConfirmed: true };

test('ordinary balance cannot unlock supplementary loan allowance', () => {
  const result = housing({ ...ready, supplementMonthly: 100, supplementBalance: 100 }, now);
  assert.equal(result.policyLimit, 1_200_000);
  assert.equal(result.balanceLimit, 1_001_000);
  assert.equal(result.loanLimit, 1_001_000);
});
test('family status alone does not grant a second borrower cap', () => {
  const result = housing({ ...ready, household: 'family', spouseFundBalance: 100_000 }, now);
  assert.equal(result.policyLimit, 1_000_000);
});
test('qualified spouse adds own allowance and income', () => {
  const result = housing({ ...ready, household: 'family', spouseFundBalance: 100_000, spouseContinuousFundMonths: 6, spouseIncomeBase: 10_000 }, now);
  assert.equal(result.policyLimit, 2_000_000);
  assert.equal(result.loanLimit, 2_000_000);
});
test('second-home base cap is 800,000 per borrower', () => {
  assert.equal(housing({ ...ready, firstHome: false }, now).policyLimit, 800_000);
});
test('minimum of all ceilings, including actual remaining purchase price', () => {
  const result = housing({ ...ready, housingPrice: 900_000, housingDownPayment: 650_000 }, now);
  assert.equal(result.loanLimit, 250_000);
  assert.equal(housing({ ...ready, incomeBase: 1000, housingLoanYears: 10 }, now).loanLimit, 48_000);
});
test('unconfirmed conditions remain unknown, short contribution fails initial check', () => {
  assert.equal(housing({ ...ready, loanConditionsConfirmed: false }, now).eligible, null);
  const short = housing({ ...ready, continuousFundMonths: 5 }, now);
  assert.equal(short.eligible, false);
  assert.equal(short.loanLimit, 0);
});
test('rent requires explicit eligibility and three continuous months', () => {
  assert.equal(housing({ ...ready, rentEligible: false }, now).rentWithdrawal, 0);
  assert.equal(housing({ ...ready, rentEligible: true, continuousFundMonths: 2 }, now).rentWithdrawal, 0);
});
test('rent cap is per household, with registered young/new-citizen exception', () => {
  assert.equal(housing({ ...ready, rentEligible: true, housingRent: 5000, rentRegistered: false }, now).rentWithdrawal, 4000);
  assert.equal(housing({ ...ready, rentEligible: true, housingRent: 5000, rentRegistered: true }, now).rentWithdrawal, 5000);
});
test('rent preserves one cent and cannot exceed available balance', () => {
  assert.equal(housing({ ...ready, fundBalance: 99.99, rentEligible: true }, now).rentWithdrawal, 99.98);
});
test('projection keeps normal and supplementary deposits and excludes interest', () => {
  const result = housing({ ...ready, fundBalance: 1000, supplementBalance: 200, fundMonthly: 700, supplementMonthly: 100, projectionYears: 1 }, now);
  assert.equal(result.balance, 1200);
  assert.equal(result.projectedBalance, 20_400);
});
test('unknown city and expired loan-rule window do not reuse current Shanghai approvals', () => {
  assert.equal(housing({ ...ready, city: '北京' }, now).loanLimit, null);
  assert.equal(housing(ready, new Date('2027-02-01T12:00:00+08:00')).loanLimit, null);
});
