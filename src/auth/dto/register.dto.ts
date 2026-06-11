import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'user@demo.com', description: 'Unique email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'User password (min 6 chars)' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'TechVision Institute', description: 'Institution name (required for institution accounts)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  institution?: string;
}
