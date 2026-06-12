import { escapeRegex } from './escape-regex';

describe('escapeRegex', () => {
  it('échappe les métacaractères regex', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegex('(a+)+b')).toBe('\\(a\\+\\)\\+b');
    expect(escapeRegex('[test]')).toBe('\\[test\\]');
    expect(escapeRegex('^$|?{}')).toBe('\\^\\$\\|\\?\\{\\}');
  });

  it('laisse intact un texte alphanumérique', () => {
    expect(escapeRegex('Cyna SOC 2026')).toBe('Cyna SOC 2026');
  });

  it("neutralise une entrée de type ReDoS (le résultat est un littéral sûr)", () => {
    const malicious = '(a+)+$';
    const escaped = escapeRegex(malicious);
    // La chaîne échappée, compilée en RegExp, matche le littéral exact et non le motif.
    const re = new RegExp(escaped);
    expect(re.test('(a+)+$')).toBe(true);
    expect(re.test('aaaaaa')).toBe(false);
  });
});
