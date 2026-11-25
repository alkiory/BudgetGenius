import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '@domain/user/user.entity';
import { AppProviderKeyService } from '@application/superadmin/app-provider-key.service';
import {
  CreateAppProviderKeyDto,
  UpdateAppProviderKeyDto,
} from '@application/superadmin/dto/app-provider-key.dto';

/**
 * Finny provider credentials. Separate from `/superadmin/api-keys`: those are
 * `bg_live_` credentials for machine clients, these are the keys the API calls
 * the model provider with.
 */
@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin/provider-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AppProviderKeyController {
  constructor(private readonly keys: AppProviderKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List provider keys (decrypted, superadmin only)' })
  list() {
    return this.keys.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add a provider key to the failover list' })
  create(@Body() dto: CreateAppProviderKeyDto) {
    return this.keys.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename, replace, reorder or disable a key' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppProviderKeyDto,
  ) {
    return this.keys.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a provider key' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.keys.remove(id);
  }
}
