import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class VerificationService {
  constructor(private readonly prismaService: PrismaService) {}

  async getVerification(userId: string) {
    const verification = await this.prismaService.client.userVerification.findUnique({
      where: { userId },
    });

    return {
      status: verification?.status ?? 'not_started',
      selfieDone: verification?.selfieDone ?? false,
      documentDone: verification?.documentDone ?? false,
      reviewedAt: verification?.reviewedAt?.toISOString() ?? null,
    };
  }

  async submitVerification(userId: string, body: Record<string, unknown>) {
    const step = typeof body.step === 'string' ? body.step : 'document';

    const verification = await this.prismaService.client.userVerification.upsert({
      where: { userId },
      update: {
        selfieDone: step == 'selfie' ? true : undefined,
        documentDone: step == 'document' ? true : undefined,
        status:
            step == 'document'
                ? 'under_review'
                : step == 'selfie'
                    ? 'selfie_submitted'
                    : 'not_started',
      },
      create: {
        userId,
        selfieDone: step == 'selfie',
        documentDone: step == 'document',
        status: step == 'document' ? 'under_review' : 'selfie_submitted',
      },
    });

    return {
      status: verification.status,
      selfieDone: verification.selfieDone,
      documentDone: verification.documentDone,
      reviewedAt: verification.reviewedAt?.toISOString() ?? null,
    };
  }
}
