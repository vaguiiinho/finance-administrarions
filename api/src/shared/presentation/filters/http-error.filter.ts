import { ArgumentsHost, BadRequestException, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, type ErrorKind } from '@shared/domain/app-error.js';

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  business_rule: 422,
  unauthenticated: 401,
  forbidden: 403,
  rate_limited: 429,
};

interface ErrorBody {
  code: string;
  message: string;
  details: unknown;
}

/** Erros HTTP no formato { code, message, details }. Mapeia só kind -> status (OCP). */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { status, body } = this.translate(exception, request);
    this.setAuthHeaders(exception, response);
    response.status(status).json(body);
  }

  /** 401 -> `WWW-Authenticate: Bearer`; 429 -> `Retry-After` (ADR 0005 6.6). */
  private setAuthHeaders(exception: unknown, response: Response): void {
    if (!(exception instanceof AppError)) return;
    if (exception.kind === 'unauthenticated') response.setHeader('WWW-Authenticate', 'Bearer');
    if (exception.kind === 'rate_limited') {
      const seconds = (exception.details as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
      if (typeof seconds === 'number') response.setHeader('Retry-After', String(seconds));
    }
  }

  private translate(exception: unknown, request: Request): { status: number; body: ErrorBody } {
    if (exception instanceof AppError) {
      return {
        status: STATUS_BY_KIND[exception.kind],
        body: { code: exception.code, message: exception.message, details: exception.details },
      };
    }

    const bodyParserType = (exception as { type?: unknown } | null)?.type;
    // O adaptador do Nest converte URIError (percent-encoding inválido no path) em BadRequestException.
    if (exception instanceof BadRequestException && /URI malformed|Failed to decode param/i.test(exception.message)) {
      return {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: {
            fields: [{ field: 'path', code: 'INVALID_FORMAT', message: 'Caminho com codificação de URL inválida.' }],
          },
        },
      };
    }
    // ... e o SyntaxError do body parser também vira BadRequestException.
    if (bodyParserType === 'entity.parse.failed' || exception instanceof BadRequestException) {
      return { status: 400, body: { code: 'MALFORMED_JSON', message: 'JSON malformado.', details: null } };
    }
    // O adaptador do Nest (>= 12.3) também embrulha os erros do body parser (http-errors) numa HttpException com o status original.
    if (bodyParserType === 'entity.too.large' || (exception instanceof HttpException && exception.getStatus() === 413)) {
      return { status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição grande demais.', details: null } };
    }

    if (exception instanceof HttpException && exception.getStatus() === 404) {
      return {
        status: 404,
        body: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Rota não encontrada.',
          details: { method: request.method, path: request.path },
        },
      };
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.', details: null } };
  }
}
