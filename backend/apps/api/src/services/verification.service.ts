import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
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

    if (step !== 'selfie' && step !== 'document') {
      throw new ApiError(400, 'invalid_verification_step', 'Verification step is invalid');
    }

    const current = await this.prismaService.client.userVerification.findUnique({
      where: { userId },
    });

    if (current?.status === 'verified') {
      return {
        status: current.status,
        selfieDone: current.selfieDone,
        documentDone: current.documentDone,
        reviewedAt: current.reviewedAt?.toISOString() ?? null,
      };
    }

    const nextSelfieDone = current?.selfieDone === true || step === 'selfie';
    const nextDocumentDone = current?.documentDone === true || step === 'document';
    const nextStatus =
      nextDocumentDone
        ? 'under_review'
        : nextSelfieDone
          ? 'selfie_submitted'
          : 'not_started';

    const verification = await this.prismaService.client.userVerification.upsert({
      where: { userId },
      update: {
        selfieDone: nextSelfieDone,
        documentDone: nextDocumentDone,
        status: nextStatus,
      },
      create: {
        userId,
        selfieDone: nextSelfieDone,
        documentDone: nextDocumentDone,
        status: nextStatus,
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
