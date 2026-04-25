import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Registration } from '../../registrations/entities/registration.entity';

export enum EventStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  category: string;

  @Column()
  date: string;

  @Column()
  time: string;

  @Column()
  location: string;

  @Column({ nullable: true })
  venue: string;

  @Column()
  institution: string;

  @Column('text')
  description: string;

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column({ default: 0 })
  capacity: number;

  @Column({ default: 0 })
  attendees: number;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  image: string;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  // The institution_admin who created this event
  @Column({ nullable: true })
  institutionAdminId: number;

  @OneToMany(() => Registration, (reg) => reg.event)
  registrations: Registration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
