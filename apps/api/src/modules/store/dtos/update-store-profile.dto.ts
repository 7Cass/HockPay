import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStoreProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  city?: string;
}
