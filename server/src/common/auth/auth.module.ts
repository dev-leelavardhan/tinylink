import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard, JwtAuthOptionalGuard } from './jwt-auth.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtAuthGuard, JwtAuthOptionalGuard],
  exports: [JwtAuthGuard, JwtAuthOptionalGuard, PassportModule, JwtModule],
})
export class AuthModule {}
