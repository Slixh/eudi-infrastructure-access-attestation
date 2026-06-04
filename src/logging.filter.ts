import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class VerboseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx  = host.switchToHttp();
    const req  = ctx.getRequest<Request>();
    const res  = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : String(exception);

    this.logger.error(
      `${req.method} ${req.url} → ${status}\n` +
      `  Headers: ${JSON.stringify(req.headers)}\n` +
      `  Body:    ${JSON.stringify(req.body)}\n` +
      `  Error:   ${JSON.stringify(message)}`,
    );

    res.status(status).json({
      statusCode: status,
      error: message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
