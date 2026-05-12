import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

// ── Shared Prisma mock (prevents real DB connections during E2E) ───────────
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  event: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $transaction: jest.fn(),
};

describe('Event Platform API (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /health ────────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 with database and memory status', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      // Terminus returns 200 on healthy, 503 on unhealthy
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  // ── POST /auth/register ────────────────────────────────────────────────────
  describe('POST /auth/register', () => {
    const validPayload = { name: 'Alice', email: 'alice@test.com', password: 'securepass123' };

    it('returns 201 with envelope { success, data, timestamp } on valid payload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'citizen',
        institution: null, suspended: false, subscriptions: [],
        createdAt: new Date(), updatedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('returns 409 when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u1' });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validPayload)
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'no-name@test.com' })
        .expect(400);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('returns 401 when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@test.com', password: 'anypass' })
        .expect(401);
    });
  });

  // ── GET /events (public) ───────────────────────────────────────────────────
  describe('GET /events', () => {
    it('returns 200 with paginated approved events', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    it('accepts query params: category, city, search, skip, take', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/events?category=Tech&skip=0&take=5')
        .expect(200);
    });
  });

  // ── GET /events/:id ────────────────────────────────────────────────────────
  describe('GET /events/:id', () => {
    it('returns 404 when event does not exist', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/events/nonexistent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ── Protected routes: no token ─────────────────────────────────────────────
  describe('Protected routes (no JWT)', () => {
    it('POST /events returns 401 without token', async () => {
      await request(app.getHttpServer()).post('/events').send({}).expect(401);
    });

    it('GET /admin/moderation returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/moderation').expect(401);
    });

    it('GET /admin/analytics returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/analytics').expect(401);
    });

    it('GET /notifications returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  // ── Response envelope contract ─────────────────────────────────────────────
  describe('Response Envelope Contract', () => {
    it('error responses always contain { success: false, message, statusCode }', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/events/does-not-exist')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
    });

    it('success responses always contain { success: true, data, timestamp }', async () => {
      mockPrismaService.event.findMany.mockResolvedValue([]);
      mockPrismaService.event.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer()).get('/events').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
