import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '@infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@infrastructure/auth/guards/roles.guard';
import { Roles } from '@infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '@domain/user/user.entity';
import { MediaService } from '@application/superadmin/media.service';

class UploadImageDto {
  /** `data:image/png;base64,…` produced by the file picker. */
  @IsString()
  @MaxLength(8_000_000)
  dataUrl: string;
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Uploads from the backoffice only: a page image is a product asset, not
   * something a regular account can push to the server.
   */
  @ApiBearerAuth()
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Store an image picked in the backoffice' })
  upload(@Body() dto: UploadImageDto) {
    return this.media.saveImage(dto.dataUrl);
  }

  /**
   * Public read: an `<img>` tag cannot send the API's bearer token on the
   * APK. Names are random and unguessable, and the response is read-only.
   */
  @Get(':file')
  @ApiOperation({ summary: 'Serve a stored image' })
  file(@Param('file') file: string, @Res() res: Response) {
    const path = this.media.pathFor(file);
    if (!path) throw new NotFoundException('Image not found');
    res.sendFile(path, { maxAge: '30d', immutable: true }, (error) => {
      if (error && !res.headersSent) {
        res.status(404).end();
      }
    });
  }
}
