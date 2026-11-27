/**
 * The authored-page contract.
 *
 * The backoffice sends whatever the editor built; `updateContent` is the only
 * thing standing between that payload and the `content` jsonb the app
 * renders. These cases pin the four rules that make it safe: blank rows are
 * dropped, ids are re-slugged and de-duplicated, unknown block types and
 * component keys are rejected, and block props are reduced to the fields the
 * registry declares (so a tampered payload cannot smuggle extra content).
 */

import { BadRequestException } from '@nestjs/common';
import { AppModuleService } from '@application/superadmin/app-module.service';

const page = {
  id: 7,
  key: 'guide',
  kind: 'page',
  content: null,
};

const buildService = () => {
  const repo = {
    findOne: jest.fn().mockResolvedValue({ ...page }),
    find: jest
      .fn()
      .mockResolvedValue([{ key: 'hero-card', kind: 'component' }]),
    save: jest.fn(async (row: unknown) => row),
  };
  // `updateContent` does not open a transaction, but the constructor needs a
  // DataSource; the stub fails loudly if that ever changes.
  const dataSource = {
    transaction: jest.fn(() => {
      throw new Error('updateContent must not open a transaction');
    }),
  };
  return { service: new AppModuleService(repo as any, dataSource as any), repo };
};

describe('AppModuleService — authored content', () => {
  it('drops blank sections and de-duplicates re-slugged ids', async () => {
    const { service, repo } = buildService();

    await service.updateContent(7, {
      sections: [
        { title: '', body: '', blocks: [], componentKeys: [] },
        { title: 'Bienvenida', body: '', blocks: [], componentKeys: [] },
        { title: 'Bienvenida', body: '', blocks: [], componentKeys: [] },
      ],
    });

    const saved = repo.save.mock.calls[0][0] as any;
    expect(saved.content.sections).toHaveLength(2);
    expect(saved.content.sections.map((section: any) => section.id)).toEqual([
      'bienvenida',
      'bienvenida-2',
    ]);
  });

  it('rejects a block type that is not in the registry', async () => {
    const { service } = buildService();

    await expect(
      service.updateContent(7, {
        sections: [
          {
            title: 'Sección',
            blocks: [{ type: 'iframe', props: {} }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a component key that does not exist', async () => {
    const { service } = buildService();

    await expect(
      service.updateContent(7, {
        sections: [{ title: 'Sección', componentKeys: ['hero-card', 'ghost'] }],
      }),
    ).rejects.toThrow(/ghost/);
  });

  it('keeps only the declared fields and clamps the values', async () => {
    const { service, repo } = buildService();

    await service.updateContent(7, {
      sections: [
        {
          title: 'Sección',
          componentKeys: ['hero-card'],
          blocks: [
            {
              type: 'callout',
              props: {
                tone: 'not-a-tone',
                title: '  Hola  ',
                body: 'Texto',
                injected: '<script>alert(1)</script>',
              },
            },
          ],
        },
      ],
    });

    const saved = repo.save.mock.calls[0][0] as any;
    const block = saved.content.sections[0].blocks[0];
    expect(block.props).toEqual({
      tone: 'info',
      title: 'Hola',
      body: 'Texto',
    });
    expect(block.props).not.toHaveProperty('injected');
  });

  it('drops empty list rows and caps the list at the schema maximum', async () => {
    const { service, repo } = buildService();

    await service.updateContent(7, {
      sections: [
        {
          title: 'Cifras',
          blocks: [
            {
              type: 'stats',
              props: {
                items: [
                  { label: '', value: '' },
                  { label: 'Ahorro', value: '1.000 €' },
                  { label: 'A', value: '1' },
                  { label: 'B', value: '2' },
                  { label: 'C', value: '3' },
                  { label: 'D', value: '4' },
                ],
              },
            },
          ],
        },
      ],
    });

    const saved = repo.save.mock.calls[0][0] as any;
    const items = saved.content.sections[0].blocks[0].props.items;
    // Four is `stats.max`; the blank row never reaches the app.
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ label: 'Ahorro', value: '1.000 €', hint: '' });
  });
});
