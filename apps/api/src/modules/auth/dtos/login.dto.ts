import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Login Request DTO
 */
export class LoginRequestDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

/**
 * Login Response DTO
 */
export class LoginResponseDto {
  accessToken: string;

  refreshToken: string;

  expiresIn: number;

  merchant: {
    id: string;
    name: string;
    email: string;
    document: string;
    formattedDocument: string;
    documentType: 'CPF' | 'CNPJ';
  };
}

/**
 * Refresh Token Request DTO
 */
export class RefreshTokenRequestDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

/**
 * Refresh Token Response DTO
 */
export class RefreshTokenResponseDto {
  accessToken: string;

  refreshToken: string;

  expiresIn: number;
}

/**
 * Logout Request DTO
 */
export class LogoutRequestDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
