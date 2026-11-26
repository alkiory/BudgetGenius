/**
 * Renaming a component must migrate every reference in one request.
 *
 * Previously only `parentKey` followed the rename; sections kept pointing at
 * the old key, so published pages dropped the placement and later saves were
 * rejected as "unknown component".
 */

import { AppModuleService } from '@application/superadmin/app-module.service';

const component = {
  id: 1,
  key: 'old-key',
  name: 'Old component',
  kind: 'component',
  parentKey: null,
  isCore: false,
  content: null,
  description: null,
};

const page = {
  id: 2,
  key: 'guide',
  name: 'Guide',
  kind: 'page',
  parentKey: null,
  isCore: false,
  description: null,
  content: {
    sections: [
      {
        id: 'one',
        title: 'One',
        body: '',
        blocks: [],
        componentKeys: ['old-key', 'other-key'],
      },
      {
        id: 'two',
        title: 'Two',
        body: '',
        blocks: [],
        componentKeys: ['other-key'],
      },
    ],
  },
};

describe('AppModuleService — key rename', () => {
  it('rewrites page component references to the new key', async () => {
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...component })
        .mockResolvedValueOnce(null),
      save: jest.fn(async (row: unknown) => row),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([page, component]),
    };
    const service = new AppModuleService(repo as any);

    await service.update(1, { key: 'new-key' });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'new-key' }),
    );
    expect(page.content.sections[0].componentKeys).toEqual([
      'new-key',
      'other-key',
    ]);
    expect(page.content.sections[1].componentKeys).toEqual(['other-key']);
  });
});
