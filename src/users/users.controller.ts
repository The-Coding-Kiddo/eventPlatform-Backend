import {
  Controller,
  Put,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateSubscriptionsDto } from '../events/dto/update-subscriptions.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Update citizen category subscriptions' })
  @UseGuards(JwtAuthGuard)
  @Put('subscriptions')
  async updateSubscriptions(
    @Body() body: UpdateSubscriptionsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.updateSubscriptions(user.sub, body.categories);
  }

  @ApiOperation({ summary: 'Update own profile (name, email)' })
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Body() body: UpdateProfileDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.updateProfile(user.sub, body);
  }

  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile-pictures',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Post('profile-picture')
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: JwtPayload,
    @Req() req?: Request,
  ) {
    if (!user) throw new ForbiddenException('Not authenticated');
    if (!file) throw new BadRequestException('No file uploaded');
    const baseUrl = `${req!.protocol}://${req!.get('host')}`;
    const url = `${baseUrl}/uploads/profile-pictures/${file.filename}`;
    return this.usersService.updateProfile(user.sub, { profilePicture: url });
  }

  @ApiOperation({ summary: 'Change own password' })
  @ApiBody({ schema: { example: { currentPassword: 'old', newPassword: 'new123' } } })
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user) throw new ForbiddenException('User session not found.');
    return this.usersService.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }
}

