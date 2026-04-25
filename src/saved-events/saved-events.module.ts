import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedEventsController } from './saved-events.controller';
import { SavedEventsService } from './saved-events.service';
import { User } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Event])],
  controllers: [SavedEventsController],
  providers: [SavedEventsService],
})
export class SavedEventsModule {}
