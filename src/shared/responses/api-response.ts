import { HttpStatus } from '@nestjs/common';

export class ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  // Code HTTP à appliquer quand success === false. Lu puis retiré du corps par
  // HttpStatusInterceptor (n'est jamais renvoyé au client).
  statusCode?: number;

  constructor(partial?: Partial<ApiResponse<T>>) {
    Object.assign(this, partial);
  }

  static success<T>(message?: string, data?: T): ApiResponse<T> {
    return new ApiResponse<T>({
      success: true,
      message,
      data,
    });
  }

  // Erreur métier. statusCode par défaut 400 ; utiliser les helpers pour des
  // codes plus précis (404, 403, 409, 401).
  static error<T>(
    message: string,
    data?: T,
    statusCode: number = HttpStatus.BAD_REQUEST,
  ): ApiResponse<T> {
    return new ApiResponse<T>({
      success: false,
      message,
      data,
      statusCode,
    });
  }

  static notFound<T>(message: string, data?: T): ApiResponse<T> {
    return ApiResponse.error(message, data, HttpStatus.NOT_FOUND);
  }

  static forbidden<T>(message: string, data?: T): ApiResponse<T> {
    return ApiResponse.error(message, data, HttpStatus.FORBIDDEN);
  }

  static unauthorized<T>(message: string, data?: T): ApiResponse<T> {
    return ApiResponse.error(message, data, HttpStatus.UNAUTHORIZED);
  }

  static conflict<T>(message: string, data?: T): ApiResponse<T> {
    return ApiResponse.error(message, data, HttpStatus.CONFLICT);
  }
}
