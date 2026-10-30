import { OwnerId } from './owner-id.js';

describe('OwnerId', () => {
  it('aceita UUID e normaliza em minusculas', () => {
    const r = OwnerId.create('0A000000-0000-7000-8000-000000000001');
    expect(r.ok && r.value.value).toBe('0a000000-0000-7000-8000-000000000001');
  });

  it.each(['', 'abc', 'not-a-uuid', '0a000000-0000-7000-8000-00000000000'])('rejeita "%s"', (raw) => {
    const r = OwnerId.create(raw);
    expect(r.ok).toBe(false);
  });

  it('equals compara pelo valor', () => {
    const a = OwnerId.create('0a000000-0000-7000-8000-000000000001');
    const b = OwnerId.create('0A000000-0000-7000-8000-000000000001');
    const c = OwnerId.create('0a000000-0000-7000-8000-000000000002');
    expect(a.ok && b.ok && c.ok && a.value.equals(b.value) && !a.value.equals(c.value)).toBe(true);
  });
});
