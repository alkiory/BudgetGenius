import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '@domain/user/user.entity';
import { AppApiKeyService } from '@application/superadmin/app-api-key.service';
import { CreateAppApiKeyDto } from '@application/superadmin/dto/app-api-key.dto';

@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AppApiKeyController {
  constructor(private readonly apiKeys: AppApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List issued API keys (hashes never returned)' })
  list() {
    return this.apiKeys.findAll();
  }

  /**
   * The response is the ONLY time `secret` is available: the server stores a
   * SHA-256 hash. A failed client (closed tab, dropped request) means issuing
   * a new key — by design.
   */
  @Post()
  @ApiOperation({ summary: 'Issue an API key and return its secret once' })
  @ApiResponse({ status: 201, description: 'Key created; `secret` shown once' })
  create(@Body() dto: CreateAppApiKeyDto) {
    return this.apiKeys.create(dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a key without deleting its audit trail' })
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.apiKeys.revoke(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a key row' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.apiKeys.remove(id);
  }
}
