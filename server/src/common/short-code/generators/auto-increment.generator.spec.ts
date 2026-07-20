import { Test, TestingModule } from '@nestjs/testing';

import { AutoIncrementGenerator } from './auto-increment.generator';
import { ShortCodeCounterService } from '../short-code-counter.service';

describe('AutoIncrementGenerator (unit)', () => {
  let generator: AutoIncrementGenerator;
  const counter = { next: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoIncrementGenerator,
        { provide: ShortCodeCounterService, useValue: counter },
      ],
    }).compile();

    generator = module.get(AutoIncrementGenerator);
  });

  it('generates a base62 code from counter value', async () => {
    counter.next.mockResolvedValue(1n);

    const code = await generator.generate({ originalUrl: 'https://example.com' });

    expect(code).toBe('1');
    expect(counter.next).toHaveBeenCalledTimes(1);
  });

  it('generates correct base62 for larger counter values', async () => {
    counter.next.mockResolvedValue(62n);

    const code = await generator.generate({ originalUrl: 'https://example.com' });

    expect(code).toBe('10');
  });

  it('propagates errors from the counter', async () => {
    counter.next.mockRejectedValue(new Error('db error'));

    await expect(
      generator.generate({ originalUrl: 'https://example.com' }),
    ).rejects.toThrow('db error');
  });
});
