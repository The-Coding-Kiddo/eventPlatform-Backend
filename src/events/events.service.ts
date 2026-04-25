import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  // Public: all approved events
  findAll() {
    return this.eventRepo.find({ where: { status: EventStatus.APPROVED } });
  }

  findOne(id: number) {
    return this.eventRepo.findOneOrFail({ where: { id } }).catch(() => {
      throw new NotFoundException(`Event #${id} not found`);
    });
  }

  // Institution admin: their own events
  findByInstitution(user: User) {
    return this.eventRepo.find({ where: { institutionAdminId: user.id } });
  }

  // Institution admin: their drafts
  findDrafts(user: User) {
    return this.eventRepo.find({
      where: { institutionAdminId: user.id, status: EventStatus.DRAFT },
    });
  }

  async create(dto: CreateEventDto, user: User): Promise<Event> {
    const event = this.eventRepo.create({
      ...dto,
      institution: user.institution,
      institutionAdminId: user.id,
      status: dto.status ?? EventStatus.DRAFT,
    });
    return this.eventRepo.save(event);
  }

  async update(id: number, dto: UpdateEventDto, user: User): Promise<Event> {
    const event = await this.findOne(id);
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      event.institutionAdminId !== user.id
    ) {
      throw new ForbiddenException('You do not own this event');
    }
    Object.assign(event, dto);
    return this.eventRepo.save(event);
  }

  async remove(id: number, user: User): Promise<{ message: string }> {
    const event = await this.findOne(id);
    if (event.institutionAdminId !== user.id) {
      throw new ForbiddenException('You do not own this event');
    }
    await this.eventRepo.remove(event);
    return { message: 'Event deleted' };
  }

  async saveDraft(dto: CreateEventDto, user: User): Promise<Event> {
    return this.create({ ...dto, status: EventStatus.DRAFT }, user);
  }
}
