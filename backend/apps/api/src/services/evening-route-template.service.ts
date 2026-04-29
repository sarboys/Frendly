import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EveningRouteTemplateService {
  constructor(private readonly prismaService: PrismaService) {}
}
