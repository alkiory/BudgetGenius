import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  Req,
  Delete,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { UserDto } from '@application/user/dto/user.dto';
import { UserService } from '@application/user/user.service';
import { User, UserRole } from '@domain/user/user.entity';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { LoggingService } from '@infrastructure/log/logger.service';

const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: LoggingService,
  ) {}

  @Get('admin')
  @Roles(UserRole.ADMIN)
  getAdminData() {
    return { message: '🪪 Admin access granted' };
  }

  @Get('userList')
  @Roles(UserRole.ADMIN)
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Get('profile')
  async getProfile(@Request() req): Promise<User> {
    const user = await this.userService.getUserByEmail(req.user.email);
    return user;
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: Partial<UserDto>,
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

    return this.userService.updateUser(currentUser.userId, {
      ...updateUserDto,
      updatedAt: new Date(),
    });
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: number, @Req() req) {
    const user = req.user;
    if (id !== user.id && user.role !== 'admin') {
      throw new UnauthorizedException(
        '⛔ You do not have permission to delete this user',
      );
    }

    return this.userService.deleteUser(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async createUser(@Body() user: UserDto): Promise<UserDto> {
    // Admin-only: signup lives on /auth/signup, so this endpoint is only
    // useful for seeding fixtures / migrations. Anonymous or non-admin
    // callers are rejected by RolesGuard via the @Roles metadata.
    const createUserDto = {
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.userService.createUser(createUserDto);
  }

  @Get(':email')
  async getUser(
    @Param('email') email: string,
    @Req() req,
  ): Promise<Partial<User>> {
    // Cross-user data leak fix: any authenticated user could previously
    // pass any email and receive the full row including the bcrypt
    // password hash and refresh token. Restrict to self unless admin.
    if (req.user.email !== email && req.user.role !== UserRole.ADMIN) {
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
