import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Registration } from '../registrations/entities/registration.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Registration)
    private readonly registrationRepo: Repository<Registration>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async buildUserResponse(user: User) {
    const saved = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ['savedEvents'],
    });
    const registrations = await this.registrationRepo.find({
      where: { userId: user.id },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institution: user.institution,
      savedEvents: saved?.savedEvents?.map((e) => e.id) ?? [],
      registeredEvents: registrations.map((r) => r.eventId),
      subscriptions: user.subscriptions ?? [],
    };
  }
}
