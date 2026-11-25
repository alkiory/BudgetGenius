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
import { AppModule } from '@domain/superadmin/app-module.entity';
import { AppModuleService } from '@application/superadmin/app-module.service';
import {
  CreateAppModuleDto,
  UpdateAppModuleDto,
} from '@application/superadmin/dto/app-module.dto';

@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin/modules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AppModuleController {
  constructor(private readonly modules: AppModuleService) {}

  @Get()
  @ApiOperation({ summary: 'List every registered module' })
  @ApiResponse({ status: 200, type: [AppModule] })
  list() {
    return this.modules.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Register a module' })
  @ApiResponse({ status: 201, type: AppModule })
  create(@Body() dto: CreateAppModuleDto) {
    return this.modules.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a module (status, version, metadata)' })
  @ApiResponse({ status: 200, type: AppModule })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppModuleDto,
  ) {
    return this.modules.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a non-core module' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.modules.remove(id);
  }
}
