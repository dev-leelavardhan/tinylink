import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppModule (unit)', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides AppController', () => {
    expect(module.get(AppController)).toBeDefined();
  });

  it('provides AppService', () => {
    expect(module.get(AppService)).toBeDefined();
  });
});
