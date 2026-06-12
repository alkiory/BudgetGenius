import { Controller, Get, UseGuards, Res } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags('Test')
@Controller('test')
export class TestController {

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Endpoint de prueba para validar JWT' })
  @ApiResponse({ status: 200, description: 'Token válido' })
  async test(@Res() res) {
    return res.json({ message: 'Token válido' });
  }
}