import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// ConfigModule.forRoot() is registered at the AppModule level; only the token is needed here.
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USER'),
        password:
          configService.get<string>('DB_PASS') ||
          configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        schema: 'bg_public',
        // FORZADO: En Docker, conectando a un contenedor local, SSL debe estar desactivado.
        // Solo se activaría si usaras una DB externa como AWS RDS.
        ssl: false,
        extra: {
          ssl: false, // Algunos drivers leen esto de la propiedad 'extra'
        },
        // En producción (Docker), buscamos los archivos compilados .js
        // En local (ts-node), buscamos los .ts
        entities: [__dirname + '/../**/*.entity.{js,ts}'],
        migrations: [__dirname + '/../migrations/*.{js,ts}'],
        // -------------------------------------------------------
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
