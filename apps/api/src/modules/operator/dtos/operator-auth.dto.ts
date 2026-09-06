/**
 * Request body for operator login.
 */
export class OperatorLoginRequestDto {
  email!: string;
  password!: string;
}

/**
 * Operator as returned by login and by /operator/me.
 *
 * There is no password hash and no store here: an operator session is not
 * scoped to a store.
 */
export class OperatorDto {
  id!: string;
  name!: string;
  email!: string;
}

export class OperatorLoginResponseDto {
  expiresIn!: number;
  operator!: OperatorDto;
}

export class OperatorRefreshResponseDto {
  expiresIn!: number;
}
