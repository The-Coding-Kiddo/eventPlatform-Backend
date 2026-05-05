import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the citizen' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'citizen@demo.com', description: 'Unique email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'User password (min 6 chars)' })
  @IsString()
  @MinLength(6)
  password!: string;
}
