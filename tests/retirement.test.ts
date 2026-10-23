import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, type Profile } from '../lib/profile';
import { retirement, retirementSources } from '../lib/retirement';

const NOW = new Date('2026-10-22T12:00:00Z');
const profile = (values: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, pensionYears:10, pensionBalance:96000, ...values });

test('male transition begins with Jan 1965 and advances after each four-month cohort', () => {
  const cases = [
    ['1964-12', 60, 0, 2024, 12],
    ['1965-01', 60, 1, 2025, 2],
    ['1965-04', 60, 1, 2025, 5],
    ['1965-05', 60, 2, 2025, 7],
    ['1965-12', 60, 3, 2026, 3],
    ['1976-08', 62, 11, 2039, 7],
    ['1976-09', 63, 0, 2039, 9],
    ['2004-07', 63, 0, 2067, 7],
  ] as const;
  for (const [birthMonth, ageYears, ageMonths, retirementYear, retirementMonth] of cases) {
    const actual = retirement(profile({ birthMonth, retirementCategory:'male' }), NOW);
    assert.deepEqual([actual.ageYears,actual.ageMonths,actual.retirementYear,actual.retirementMonth], [ageYears,ageMonths,retirementYear,retirementMonth], birthMonth);
  }
});

test('female 55 and female 50 cohorts use different anchors, steps and caps', () => {
  for (const [category,birth,years,months] of [
    ['female55','1969-12',55,0],['female55','1970-01',55,1],
    ['female55','1970-05',55,2],['female55','1981-09',58,0],
    ['female50','1974-12',50,0],['female50','1975-01',50,1],
    ['female50','1975-02',50,1],['female50','1975-03',50,2],
    ['female50','1984-10',54,11],['female50','1984-11',55,0],
  ] as const) {
    const r = retirement(profile({ birthMonth:birth, retirementCategory:category }), NOW);
    assert.deepEqual([r.ageYears,r.ageMonths],[years,months],`${category} ${birth}`);
  }
});

test('minimum contribution duration follows the retirement year, not the current year', () => {
  assert.equal(retirement(profile({birthMonth:'1968-01'}), NOW).minYears,15);
  assert.equal(retirement(profile({birthMonth:'1969-01'}), NOW).minYears,15.5);
  assert.equal(retirement(profile({birthMonth:'1970-01'}), NOW).minYears,16);
  assert.equal(retirement(profile({birthMonth:'2004-07'}), NOW).minYears,20);
});

test('eligibility threshold compares actual duration without rounding a shortfall up', () => {
  const date = new Date('2030-02-10T12:00:00Z');
  assert.equal(retirement(profile({birthMonth:'1969-01',pensionYears:15.5}),date).eligible,true);
  assert.equal(retirement(profile({birthMonth:'1969-01',pensionYears:15.49999}),date).eligible,false);
});

test('non-integer retirement age has no invented divisor, but a verified override works', () => {
  const without = retirement(profile({birthMonth:'1965-01'}),NOW);
  assert.equal(without.divisor,null);
  assert.equal(without.personal,null);
  assert.equal(without.total,null);
  const withOverride = retirement(profile({birthMonth:'1965-01',divisorOverride:138.4}),NOW);
  assert.equal(withOverride.divisor,138.4);
  assert.ok(withOverride.total !== null);
  assert.equal(retirement(profile({birthMonth:'1965-01',divisorOverride:0}),NOW).divisor,null);
});

test('whole-year retirement uses the matching national divisor rather than always 139', () => {
  assert.equal(retirement(profile(),NOW).divisor,117);
  assert.equal(retirement(profile({retirementCategory:'female55'}),NOW).divisor,152);
  assert.equal(retirement(profile({retirementCategory:'female50'}),NOW).divisor,170);
});

test('missing or malformed birth month falls back to age using the Shanghai month', () => {
  // In Shanghai this instant is November; Los Angeles remains October.
  const date = new Date('2026-10-31T16:30:00Z');
  const r = retirement(profile({birthMonth:'',age:22}),date);
  assert.deepEqual([r.retirementYear,r.retirementMonth],[2067,11]);
  assert.equal(r.approximate,true);
  assert.ok(r.notes.some(note=>note.includes('近似推算')));
  const invalid = retirement(profile({birthMonth:'2004-13',age:22}),date);
  assert.equal(invalid.retirementMonth,11);
});

test('zero-growth projection uses current personal balance plus future personal deposits only', () => {
  const date = new Date('2038-09-10T12:00:00Z');
  const r = retirement(profile({birthMonth:'1976-09',pensionYears:20,pensionBalance:117000,pensionMonthly:1170,accountGrowth:0}),date);
  assert.equal(r.remainingYears,1);
  assert.equal(r.projectedYears,21);
  assert.equal(r.personal,1120); // (117000 + 12*1170) / 117
  assert.equal(r.basic,2641.2); // 12577 * 21% = 2641.17; next jiao
  assert.equal(r.total,3761.2);
});

test('zero actual balance is respected and missing balance is explicitly estimated', () => {
  const date = new Date('2039-09-10T12:00:00Z');
  const base = profile({birthMonth:'1976-09',pensionYears:20,pensionMonthly:800,pensionBalance:0});
  assert.equal(retirement(base,date).personal,0);
  const estimated = retirement({...base,pensionBalance:null},date);
  assert.equal(estimated.personal,1641.1); // 20*12*800 / 117, upwards to jiao
  assert.ok(estimated.notes.some(note=>note.includes('未填写实际养老账户余额')));
});

test('growth parameter is an annual percentage scenario and not a monthly rate', () => {
  const date = new Date('2038-09-10T12:00:00Z');
  const r = retirement(profile({birthMonth:'1976-09',pensionYears:20,pensionBalance:117000,pensionMonthly:0,accountGrowth:5}),date);
  assert.equal(r.personal,1050);
});

test('past retirement is not treated as negative future contributions and sources use the 2026 replacement', () => {
  const r = retirement(profile({birthMonth:'1964-12'}),NOW);
  assert.equal(r.remainingYears,0);
  assert.equal(r.projectedYears,10);
  assert.ok(r.notes.some(note=>note.includes('已过去')));
  assert.ok(retirementSources.some(source=>source.title.includes('2026') && source.effective.includes('2031-08-15')));
});
