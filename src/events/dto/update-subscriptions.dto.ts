import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubscriptionsDto {
  @ApiProperty({ example: ['Technology', 'Music'] })
  @IsArray()
  @IsString({ each: true })
  categories!: string[];
}
