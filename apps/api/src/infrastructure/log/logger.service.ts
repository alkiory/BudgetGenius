import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, json, colorize } = format;

@Injectable()
export class LoggingService implements LoggerService {
  private consoleLogFormat = format.combine(
    format.colorize(),
    format.printf(
      ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`,
    ),
  );

  // Create a Winston logger
  private logger = createLogger({
    level: 'info',
    format: combine(
      colorize(),
      timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
      json(),
    ),
    transports: [
      new transports.Console({
        format: this.consoleLogFormat,
      }),
      new transports.File({ filename: 'logs/app.log', level: 'info' }),
      new transports.File({ filename: 'logs/error.log', level: 'error' }),
    ],
  });

  log(message: string, trace?: any) {
    this.logger.info(message, { trace });
  }

  error(message: string, trace?: any) {
    this.logger.error(message, { trace });
  }

  warn(message: string, trace?: any) {
    this.logger.warn(message, { trace });
  }
}
