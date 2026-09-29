import { FIELD_MAP, REQUIRED_FIELDS, resolveField } from '../src/modules/nhia/fieldMapping';
import { fixtureInpatientBundle } from './helpers/nhiaFixtures';

describe('NHIA field mapping - Step 6.1 gate', () => {
  it('has a resolver registered for every required field', () => {
    for (const field of REQUIRED_FIELDS) {
      expect(FIELD_MAP[field]).toBeDefined();
    }
  });

  it('resolves every required field to a non-null value for a complete fixture', () => {
    const bundle = fixtureInpatientBundle();
    for (const field of REQUIRED_FIELDS) {
      const value = resolveField(field, bundle);
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });

  it('throws for an unregistered field name, rather than silently returning undefined', () => {
    expect(() => resolveField('SomeFieldThatDoesNotExist', fixtureInpatientBundle())).toThrow();
  });

  it('formats DateOfBirth as DD/MM/YYYY per the spec pattern', () => {
    const value = resolveField('DateOfBirth', fixtureInpatientBundle());
    expect(value).toBe('16/05/1987');
  });
});
