import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteAttendeeDto {
  @ApiProperty({ example: 'citizen@demo.com', description: 'Email address of the attendee' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Name of the attendee' })
  @IsString()
  @IsOptional()
  name?: string;
}
