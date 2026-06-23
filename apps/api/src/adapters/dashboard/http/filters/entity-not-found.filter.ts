import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { EntityNotFoundError } from 'typeorm';

/**
 * Translates TypeORM's `EntityNotFoundError` (raised by `findOneOrFail`,
 * `findByName`, etc.) into a clean 404 at the HTTP boundary.
 *
 * Without this filter, Nest's default exception filter would map the
 * TypeORM error to a 500 — which is wrong for the multi-tenant
 * case where the row genuinely doesn't exist or belongs to another
 * user, and also leaks implementation details ("we use TypeORM").
 *
 * Opt-in via `@UseFilters(EntityNotFoundExceptionFilter)` on the
 * controllers whose repos use `findOneOrFail`. Scoped per-controller
 * to avoid changing behavior elsewhere in the app.
 *
 * INTENTIONALLY NARROW: this filter catches `EntityNotFoundError`
 * only. TypeORM also has driver-specific errors (NoMetadataError,
 * QueryFailedError, etc.) — those are NOT converted here. Those would
 * still surface as 500 from Nest's default filter, which is the
 * correct behaviour for genuine SQL/server faults. Don't widen `Catch()`
 * without checking that the broader semantics are still appropriate.
 */
@Catch(EntityNotFoundError)
export class EntityNotFoundExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EntityNotFoundExceptionFilter.name);

  catch(exception: EntityNotFoundError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Use the original Nest exception class so the global error mapper's
    // body shape stays consistent with other 404s in the app. We do NOT
    // surface TypeORM-internal fields in the response — that would leak
    // implementation details.
    this.logger.debug(
      `Translating EntityNotFoundError → NotFoundException: ${exception.message}`,
    );

    const notFound = new NotFoundException('Resource not found');
    response.status(notFound.getStatus()).json(notFound.getResponse());
  }
}
