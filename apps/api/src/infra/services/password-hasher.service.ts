import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { IPasswordHasherPort } from '@hockpay/core';

/**
 * Infrastructure implementation of IPasswordHasherPort.
 *
 * This service uses argon2 for password hashing and verification.
 */
@Injectable()
export class PasswordHasherService implements IPasswordHasherPort {
  async hash(password: string): Promise<string> {
    return await hash(password);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  }
}
