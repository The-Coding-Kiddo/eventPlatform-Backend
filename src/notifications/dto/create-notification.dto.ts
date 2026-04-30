import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  /** Target a specific user. Omit to broadcast by role/category/institution. */
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  forRole?: string;

  @IsString()
  @IsOptional()
  forCategory?: string;

  @IsString()
  @IsOptional()
  forInstitution?: string;

  /** ID of the related event, if any. */
  @IsString()
  @IsOptional()
  eventId?: string;
}
