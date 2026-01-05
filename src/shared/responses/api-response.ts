export class ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;

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

  static error<T>(message: string, data?: T): ApiResponse<T> {
    return new ApiResponse<T>({
      success: false,
      message,
      data,
    });
  }
}
