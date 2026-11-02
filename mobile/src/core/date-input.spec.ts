import { isoToDateInput, maskDateInput, parseDateInput } from '@/core/date-input';

describe('maskDateInput', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['05', '05'],
    ['051', '05/1'],
    ['0511', '05/11'],
    ['05112', '05/11/2'],
    ['05112026', '05/11/2026'],
    ['05/11/2026', '05/11/2026'],
    ['051120261234', '05/11/2026'],
    ['ab05-11x2026', '05/11/2026'],
  ])('%j -> %j', (raw, expected) => expect(maskDateInput(raw)).toBe(expected));
});

describe('parseDateInput', () => {
  it('converte dd/mm/aaaa para ISO civil', () => expect(parseDateInput('05/11/2026')).toBe('2026-11-05'));
  it.each(['', '05/11', '5/11/2026', '05/11/26', '2026-11-05', '05-11-2026', '05/11/2026 '])('texto incompleto %j -> vazio', (t) =>
    expect(parseDateInput(t)).toBe(''));
  it('ida e volta com a mascara', () => expect(parseDateInput(maskDateInput('29022028'))).toBe('2028-02-29'));
});

describe('isoToDateInput', () => {
  it('ISO civil -> dd/mm/aaaa', () => expect(isoToDateInput('2026-11-05')).toBe('05/11/2026'));
  it('ida e volta com parseDateInput', () => expect(parseDateInput(isoToDateInput('2026-01-31'))).toBe('2026-01-31'));
  it('data invalida lanca RangeError', () => expect(() => isoToDateInput('x')).toThrow(RangeError));
});
