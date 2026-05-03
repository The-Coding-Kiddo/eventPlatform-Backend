import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ example: 'new_event' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: 'New Event Alert' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'A new event has been created.' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  /** Target a specific user. Omit to broadcast by role/category/institution. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  forRole?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  forCategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  forInstitution?: string;

  /** ID of the related event, if any. */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;
}
