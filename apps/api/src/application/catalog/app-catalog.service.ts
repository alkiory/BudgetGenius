import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AppModule,
  AppModuleKind,
  AppModuleStatus,
} from '@domain/superadmin/app-module.entity';
import { User, UserRole } from '@domain/user/user.entity';

/**
 * Read side of the catalogue registered in the backoffice.
 *
 * This is what makes the inventory real: the SPA renders a sidebar entry and a
 * page for every `module` / `page` returned here, and the tabs of a page are
 * the `tab` entries whose `parentKey` points at it.
 *
 * Visibility rule:
 * - `active` entries are live for every signed-in account.
 * - `beta` and `disabled` ones are only returned to the superadmin, so an
 *   unfinished page can be reviewed in place (and fixed) without leaking it
 *   to users.
 */
@Injectable()
export class AppCatalogService {
  constructor(
    @InjectRepository(AppModule)
    private readonly modules: Repository<AppModule>,
    // The role is read from the row, not from the JWT. A demoted operator's
    // token keeps claiming `superadmin` for up to seven days, and the private
    // half of the inventory (beta/disabled pages, internal modules) must not
    // stay readable through it.
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findVisibleFor(userId?: number): Promise<AppModule[]> {
    const order = { sortOrder: 'ASC' as const, name: 'ASC' as const };
    const account = userId
      ? await this.users.findOne({
          where: { id: Number(userId) },
          select: ['id', 'role'],
        })
      : null;
    const role = account?.role;

    if (role === UserRole.SUPERADMIN) {
      // The operator reviews the whole inventory, including what is not live
      // and the internal building blocks that never render on their own.
      return this.modules.find({
        where: { status: In<AppModuleStatus>(['active', 'beta', 'disabled']) },
        order,
      });
    }

    // Regular accounts only receive finished screens. Components and
    // integrations are internal building blocks and would leak the roadmap,
    // so they stay in the backoffice.
    const visible = await this.modules.find({
      where: {
        status: 'active',
        kind: In<AppModuleKind>(['module', 'page', 'tab']),
      },
      order,
    });

    // A tab only exists inside its page: if the page was disabled, the tab
    // must not survive as an orphan section.
    const pageKeys = new Set(
      visible
        .filter((entry) => entry.kind === 'page')
        .map((entry) => entry.key),
    );
    const reachable = visible.filter(
      (entry) =>
        entry.kind !== 'tab' ||
        (entry.parentKey !== null && pageKeys.has(entry.parentKey)),
    );

    // Components are internal building blocks, not navigation; only the ones a
    // visible page actually places are returned, so their content renders for
    // the user without exposing the rest of the roadmap. Their own status is
    // not filtered: a page that is live but still places a component marked
    // beta would otherwise lose that fragment for every user.
    const placed = new Set<string>();
    for (const entry of reachable) {
      for (const section of entry.content?.sections ?? []) {
        for (const key of section.componentKeys) placed.add(key);
      }
    }
    if (!placed.size) return reachable;

    const components = await this.modules.find({
      where: { key: In(Array.from(placed)), kind: 'component' },
      order,
    });
    return [...reachable, ...components];
  }
}
