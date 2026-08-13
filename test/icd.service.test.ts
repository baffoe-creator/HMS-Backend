import * as icdService from '../src/modules/icd/icd.service';
import * as icdRepo from '../src/modules/icd/icd.repository';
import { IcdCodeRecord } from '../src/modules/icd/icd.repository';

jest.mock('../src/modules/icd/icd.repository');
const mockedRepo = icdRepo as jest.Mocked<typeof icdRepo>;

function fakeCode(overrides: Partial<IcdCodeRecord> = {}): IcdCodeRecord {
  return {
    id: 1,
    code: 'J45',
    description: 'Asthma',
    version: 'v1',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('IcdService - Step 3.1 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('looks up the active version of a code', async () => {
    mockedRepo.findActiveByCode.mockResolvedValue(fakeCode());
    const result = await icdService.lookupActive('J45');
    expect(result.code).toBe('J45');
  });

  it('throws NotFoundError when no active version exists', async () => {
    mockedRepo.findActiveByCode.mockResolvedValue(undefined);
    await expect(icdService.lookupActive('ZZZ')).rejects.toBeInstanceOf(icdService.NotFoundError);
  });

  it('bumpVersion deactivates the old version and inserts a new active one', async () => {
    mockedRepo.insert.mockResolvedValue(fakeCode({ id: 2, version: 'v2' }));

    const result = await icdService.bumpVersion({
      code: 'J45',
      description: 'Asthma, updated description',
      newVersion: 'v2',
    });

    expect(mockedRepo.deactivateActiveVersions).toHaveBeenCalledWith('J45');
    expect(mockedRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'J45', version: 'v2', isActive: true }),
    );
    expect(result.version).toBe('v2');
  });

  it('rejects a version bump missing required fields', async () => {
    await expect(
      icdService.bumpVersion({ code: 'J45' } as unknown as Parameters<typeof icdService.bumpVersion>[0]),
    ).rejects.toBeInstanceOf(icdService.ValidationError);
    expect(mockedRepo.deactivateActiveVersions).not.toHaveBeenCalled();
  });
});
