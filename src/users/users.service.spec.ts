import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateSubscriptions', () => {
    it('updates user category subscriptions and returns them', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.updateSubscriptions('user-1', ['Tech', 'Music']);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { subscriptions: ['Tech', 'Music'] },
      });
      expect(result).toEqual({ subscriptions: ['Tech', 'Music'] });
    });

    it('allows clearing subscriptions with an empty array', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      const result = await service.updateSubscriptions('user-1', []);
      expect(result.subscriptions).toHaveLength(0);
    });
  });
});
