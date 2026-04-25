import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Event } from '../../events/entities/event.entity';
import { Registration } from '../../registrations/entities/registration.entity';
import { Notification } from '../../notifications/entities/notification.entity';

export enum UserRole {
  CITIZEN = 'citizen',
  INSTITUTION_ADMIN = 'institution_admin',
  SUPER_ADMIN = 'super_admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CITIZEN })
  role: UserRole;

  @Column({ nullable: true })
  institution: string;

  @Column('simple-array', { nullable: true, default: null })
  subscriptions: string[];

  @ManyToMany(() => Event, { eager: false })
  @JoinTable({ name: 'user_saved_events' })
  savedEvents: Event[];

  @OneToMany(() => Registration, (reg) => reg.user)
  registrations: Registration[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
