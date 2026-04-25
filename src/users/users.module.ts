import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Registration } from '../registrations/entities/registration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Registration])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
