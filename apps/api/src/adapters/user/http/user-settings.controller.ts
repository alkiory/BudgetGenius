import { Controller, Get, Body, Req, UseGuards, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { UserSettingsService } from '@application/user/user-settings.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('User Settings')
@ApiBearerAuth()
@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private userService: UserSettingsService) { }

  @Get()
  @ApiOperation({
    summary: 'Get user settings',
    description: 'Get user settings like timezone, currency, and locale',
  })
  @ApiResponse({
    status: 200,
    description: 'User settings retrieved successfully',
    type: UserSettingsService,
    examples: {
      'application/json': {
        value: {
          timezone: 'UTC',
          currency: 'USD',
          locale: 'en-US',
        },
        summary: 'User settings retrieved successfully',
      },
    },
  })
  getSettings(@Req() req) {
    return this.userService.getOrCreateSettings(req.user.userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update user settings',
    description: 'Update user settings like timezone, currency, and locale',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    required: false,
    type: 'string',
    examples: {
      'application/json': {
        value: '12345',
        summary: 'User ID',
      },
    },
  })
  @ApiParam({
    name: 'settings',
    description: 'User settings to update',
    required: false,
    type: 'object',
    examples: {
      'application/json': {
        value: {
          timezone: 'UTC',
          currency: 'USD',
          locale: 'en-US',
        },
        summary: 'User settings to update',
      },
    },
  })
  @ApiBody({
    description: 'User settings to update',
    type: UserSettingsService,
    examples: {
      'application/json': {
        value: {
          timezone: 'UTC',
          currency: 'USD',
          locale: 'en-US',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User settings updated successfully',
    type: UserSettingsService,
    examples: {
      'application/json': {
        value: {
          timezone: 'UTC',
          currency: 'USD',
          locale: 'en-US',
        },
        summary: 'User settings updated successfully',
      },
    },
  })
  updateSettings(
    @Req() req,
    @Body() body: { timezone?: string; currency?: string; locale?: string },
  ) {
    return this.userService.updateSettings(req.user.userId, body);
  }
}
