import { Module } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { InstitutionController } from './institution.controller';
import { InstitutionProfileController } from './institution-profile.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InstitutionService],
  controllers: [InstitutionController, InstitutionProfileController]
})
export class InstitutionModule {}
