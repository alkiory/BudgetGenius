import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Endpoint raíz de la API' })
  @ApiResponse({
    status: 200,
    description: 'API funcionando correctamente',
    schema: {
      example: {
        status: 'running',
        message: 'Budget Genius API',
        timestamp: '2025-04-08T22:13:25.000Z',
        docs: '/api',
        health: '/health',
      },
    },
  })

  getRoot() {
    return {
      status: 'running',
      message: 'Budget Genius API',
      timestamp: new Date().toISOString(),
      docs: '/api',
      health: '/health',
    };
  }
}
