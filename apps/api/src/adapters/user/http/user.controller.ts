import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UnauthorizedException,
  ForbiddenException,
  Req,
  Delete,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import {
  profilePatch,
  UpdateUserDto,
} from '@application/user/dto/update-user.dto';
import { ChangePasswordDto } from '@application/user/dto/change-password.dto';
import { UserService } from '@application/user/user.service';
import { User } from '@domain/user/user.entity';
import { LoggingService } from '@infrastructure/log/logger.service';
import { PublicUser, toPublicUser } from '@application/user/public-user';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: LoggingService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req): Promise<PublicUser | null> {
    const user = await this.userService.getUserByEmail(req.user.email);
    // QA-0.2 — this used to return the raw entity, so every boot of the
    // SPA pulled the bcrypt hash and hashed refresh token into browser
    // memory (and any devtools network log). Project through the
    // allow-list instead.
    return toPublicUser(user);
  }

  /**
   * Declared before `PUT :id`: Nest matches routes in declaration order, and
   * `password` would otherwise bind to the id parameter.
   */
  @Put('password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req) {
    return this.userService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req,
  ) {
    const currentUser = req.user;
    const user = await this.userService.getUserByEmail(currentUser.email);
    if (Number(id) !== user.id) {
      this.logger.warn(
        `User ${currentUser.email} attempted to update user with id ${id} without permission`,
      );
      throw new UnauthorizedException(
        '⛔ You do not have permission to update this user',
      );
    }

    // Only the editable profile fields reach the repository. Spreading the
    // body would let the caller write `role`, `email` or `authProvider`.
    const updated = await this.userService.updateUser(
      currentUser.userId,
      profilePatch(updateUserDto),
    );

    // Same leak class as /user/profile: the updated row still contains
    // `password`/`refreshToken`.
    return toPublicUser(updated);
  }

  @Delete(':id')
  // v1.7.3 introduced ParseIntPipe on the `:id` URL param (string vs number
  // guard). v1.7.4 — second root-cause fix for the SAME production symptom
  // (self-delete still returned 401): the previous `req.user.id` reads
  // returned `undefined` because `JwtStrategy.validate` exposes the
  // decoded JWT payload as `{ userId, email, role }`, NOT `{ id, email,
  // role }`. So `id !== user?.id` was effectively `8 !== undefined` → true,
  // throwing on every self-delete. The WHOLE rest of the codebase reads
  // `req.user.userId` (overview, transaction, expense-category, budget,
  // reports, user-settings, ai) — see `ai.controller.ts:11-17`'s own
  // previous-affected-line comment which already documented this gotcha
  // for the AI service. `user.controller.ts#deleteUser` was the single
  // outlier that the previous-fix PR overlooked; v1.7.3 silently kept
  // the same symptom with a different runtime shape. The admin short-
  // circuit (`user?.role !== 'admin'`) is restored here so future admin
  // backoffice can still clean up arbitrary rows.
  async deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const user = req.user;
    if (id !== user?.userId && user?.role !== 'admin') {
      throw new UnauthorizedException(
        '⛔ This user does not have permission to delete this account',
      );
    }

    return this.userService.deleteUser(id);
  }

  @Get(':email')
  async getUser(
    @Param('email') email: string,
    @Req() req,
  ): Promise<Partial<User>> {
    // Cross-user data leak fix: any authenticated user could previously
    // pass any email and receive the full row including the bcrypt
    // password hash and refresh token. Restrict to self unless admin.
    if (req.user.email !== email) {
      this.logger.warn(
        `User ${req.user.email} attempted to read profile for ${email}`,
      );
      throw new ForbiddenException('⛔ You can only retrieve your own profile');
    }
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      throw new ForbiddenException('⛔ User not found');
    }
    // Strip sensitive fields from the response. The full row is still in
    // the repo (and would still leak via /auth/verify) but at least the
    // GET-by-email surface doesn't return the bcrypt hash.
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }
}
