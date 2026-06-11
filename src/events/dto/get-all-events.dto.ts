import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetAllEventsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by institution name' })
  @IsOptional()
  @IsString()
  institutionId?: string;
}
