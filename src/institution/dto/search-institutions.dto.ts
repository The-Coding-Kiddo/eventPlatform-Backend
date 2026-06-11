import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SearchInstitutionsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by institution name' })
  @IsOptional()
  @IsString()
  search?: string;
}
