import { IsArray, IsString } from 'class-validator';

export class UpdateSubscriptionsDto {
  @IsArray()
  @IsString({ each: true })
  categories!: string[];
}
