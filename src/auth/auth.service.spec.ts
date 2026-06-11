import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

// bcrypt is a CommonJS module — jest.spyOn cannot redefine its non-configurable
// exports. Module-level mock is the only reliable approach.
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const baseUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@test.com',
  password: '$2b$10$hashedpassword',
  role: 'citizen' as const,
  institution: null,
  suspended: false,
  subscriptions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  savedEvents: [],
  registeredEvents: [],
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── register ───────────────────────────────────────────────────────────────
  describe('register', () => {
    it('creates a citizen user and returns them without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(baseUser);

      const result = await service.register('Alice', 'alice@test.com', 'password123');

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'citizen' }),
        }),
      );
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws ConflictException when email is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.register('Alice', 'alice@test.com', 'pass')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(baseUser);

      await service.register('Alice', 'alice@test.com', 'plaintext');

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe('plaintext');
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns a token and user (without password) on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login('alice@test.com', 'password123');

      expect(result).toHaveProperty('token', 'mock.jwt.token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).toHaveProperty('savedEvents');
      expect(result.user).toHaveProperty('registeredEvents');
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('ghost@test.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login('alice@test.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('includes institution in JWT payload for institution', async () => {
      const adminUser = { ...baseUser, role: 'institution' as const, institution: 'MIT' };
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await service.login('admin@mit.com', 'pass');

      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ institution: 'MIT' }),
      );
    });
  });

  // ── getMe ──────────────────────────────────────────────────────────────────
  describe('getMe', () => {
    it('returns user without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getMe('user-1');

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id', 'user-1');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── provision ──────────────────────────────────────────────────────────────
  describe('provision', () => {
    it('creates an institution account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const adminUser = { ...baseUser, role: 'institution' as const, institution: 'MIT' };
      mockPrisma.user.create.mockResolvedValue(adminUser);

      const result = await service.provision('Bob', 'bob@mit.com', 'pass', 'MIT');

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'institution', institution: 'MIT' }),
        }),
      );
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws ConflictException when email is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.provision('Bob', 'alice@test.com', 'pass', 'MIT')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when institution is blank', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.provision('Bob', 'bob@test.com', 'pass', '  ')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
