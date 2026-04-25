import { IsString, IsNumber, IsOptional, IsArray, IsEnum, Min } from 'class-validator';
import { EventStatus } from '../entities/event.entity';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsString()
  date: string;

  @IsString()
  time: string;

  @IsString()
  location: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  image?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;
}
