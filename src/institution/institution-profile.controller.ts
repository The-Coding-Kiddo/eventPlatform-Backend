import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SearchInstitutionsDto } from './dto/search-institutions.dto';

@ApiTags('Institutions')
@Controller('institutions')
export class InstitutionProfileController {
  constructor(
    private readonly institutionService: InstitutionService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Search/list institutions' })
  @ApiQuery({ name: 'search', required: false })
  @Get()
  async listInstitutions(@Query() query: SearchInstitutionsDto) {
    return this.institutionService.searchInstitutions(query.search, query);
  }

  @ApiOperation({ summary: 'Get public institution profile' })
  @Get(':id')
  async getProfile(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        institution: true,
        bio: true,
        profilePicture: true,
        _count: { select: { followers: true } },
      },
    });
    if (!user) throw new NotFoundException('Institution not found');

    return {
      id: user.id,
      name: user.name,
      institution: user.institution,
      bio: user.bio,
      profilePicture: user.profilePicture,
      followerCount: user._count.followers,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow an institution' })
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async follow(@Param('id') id: string, @CurrentUser() currentUser?: JwtPayload) {
    if (!currentUser) throw new ForbiddenException('Not authenticated');
    if (currentUser.sub === id) throw new ForbiddenException('Cannot follow yourself');

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Institution not found');

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followedId: { followerId: currentUser.sub, followedId: id } },
    });
    if (existing) throw new ConflictException('Already following this institution');

    await this.prisma.follow.create({
      data: { followerId: currentUser.sub, followedId: id },
    });
    return { success: true, message: 'Now following this institution' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow an institution' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollow(@Param('id') id: string, @CurrentUser() currentUser?: JwtPayload) {
    if (!currentUser) throw new ForbiddenException('Not authenticated');

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followedId: { followerId: currentUser.sub, followedId: id } },
    });
    if (!existing) throw new NotFoundException('Not currently following this institution');

    await this.prisma.follow.delete({ where: { id: existing.id } });
    return { success: true, message: 'Unfollowed institution' };
  }
}
