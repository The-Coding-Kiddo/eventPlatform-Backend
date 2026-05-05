import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  // 1. Create Super Admin
  await prisma.user.upsert({
    where: { email: 'superadmin@demo.com' },
    update: {},
    create: {
      email: 'superadmin@demo.com',
      name: 'Super Admin',
      password: hashedPassword,
      role: 'super_admin',
    },
  });

  // 2. Create Institution Admin
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'TechVision Admin',
      password: hashedPassword,
      role: 'institution_admin',
      institution: 'TechVision Institute',
    },
  });

  // 3. Create Citizen
  await prisma.user.upsert({
    where: { email: 'citizen@demo.com' },
    update: {},
    create: {
      email: 'citizen@demo.com',
      name: 'Alex Rivera',
      password: hashedPassword,
      role: 'citizen',
      subscriptions: ['Technology', 'Music'],
    },
  });

  // 4. Create some events
  // First clean up old events to avoid unique constraint issues if any, or just createMany
  await prisma.event.deleteMany({ where: { institution: { in: ['TechVision Institute', 'City Arts Council', 'Code for All'] } } });

  await prisma.event.createMany({
    data: [
      {
        title: 'Global Tech Summit 2026',
        category: 'Technology',
        date: '2026-06-15',
        time: '09:00',
        location: 'San Francisco',
        venue: 'Moscone Center',
        institution: 'TechVision Institute',
        description: 'The biggest tech event of the year.',
        capacity: 500,
        status: 'approved',
        price: 99.99,
        tags: ['AI', 'Web3', 'Future'],
      },
      {
        title: 'Jazz in the Park',
        category: 'Music',
        date: '2026-07-20',
        time: '18:00',
        location: 'New York',
        venue: 'Central Park',
        institution: 'City Arts Council',
        description: 'A relaxing evening of live jazz music.',
        capacity: 200,
        status: 'approved',
        price: 0,
        tags: ['Jazz', 'Live', 'Summer'],
      },
      {
        title: 'Community Hackathon',
        category: 'Technology',
        date: '2026-05-10',
        time: '10:00',
        location: 'Austin',
        venue: 'Downtown Hub',
        institution: 'Code for All',
        description: 'Build projects for the community.',
        capacity: 50,
        status: 'pending',
        price: 0,
        tags: ['Coding', 'Community'],
      },
    ],
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
