import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ProvisionDto {
  @ApiProperty({ example: 'Tech Admin', description: 'Name of the admin' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'admin@tech.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'TechVision Institute' })
  @IsString()
  @IsNotEmpty()
  institution!: string;
}
