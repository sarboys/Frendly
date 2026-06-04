import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';

type ModerationReason =
  | 'drugs'
  | 'violence'
  | 'hate'
  | 'sexual_content'
  | 'scam';

type ModerationPattern = {
  reason: ModerationReason;
  patterns: RegExp[];
};

export type ContentModerationText = {
  field: string;
  value: string | null | undefined;
};

@Injectable()
export class ContentModerationService {
  private readonly groups: ModerationPattern[] = [
    {
      reason: 'drugs',
      patterns: [
        /(?:^|[^\p{L}\p{N}_])наркотик[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])кокаин[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])героин[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])мефедрон[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])амфетамин[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])закладк[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])cocaine(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])heroin(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])meth(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])mdma(?=$|[^\p{L}\p{N}_])/iu,
      ],
    },
    {
      reason: 'violence',
      patterns: [
        /(?:^|[^\p{L}\p{N}_])уб(?:ить|ью|ьем|ивать)(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])убийств(?:о|а)?(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])зареж[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])изнасил[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])kill(?:ing|er|s)?(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])murder(?:ed|er|s)?(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])rape(?:d|s|r)?(?=$|[^\p{L}\p{N}_])/iu,
      ],
    },
    {
      reason: 'hate',
      patterns: [
        /(?:^|[^\p{L}\p{N}_])нацист[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])фашист[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])расист[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])nazi(?:s)?(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])white\s+power(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])heil\s+hitler(?=$|[^\p{L}\p{N}_])/iu,
      ],
    },
    {
      reason: 'sexual_content',
      patterns: [
        /(?:^|[^\p{L}\p{N}_])порно[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])проституц[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])эскорт[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])porn(?:hub)?(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])prostitut(?:e|ion)(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])onlyfans(?=$|[^\p{L}\p{N}_])/iu,
      ],
    },
    {
      reason: 'scam',
      patterns: [
        /(?:^|[^\p{L}\p{N}_])казино(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])скам[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])быстр(?:ый|ые|о)\s+заработ[а-яё]*(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])casino(?=$|[^\p{L}\p{N}_])/iu,
        /(?:^|[^\p{L}\p{N}_])easy\s+money(?=$|[^\p{L}\p{N}_])/iu,
      ],
    },
  ];

  assertAllowed(texts: ContentModerationText[]) {
    for (const item of texts) {
      const value = item.value?.trim();
      if (value == null || value.length === 0) {
        continue;
      }
      const result = this.check(value);
      if (result != null) {
        throw new ApiError(
          400,
          'content_moderation_rejected',
          'Text did not pass content moderation',
          {
            field: item.field,
            reason: result.reason,
          },
        );
      }
    }
  }

  check(text: string): { reason: ModerationReason } | null {
    const normalized = this.normalize(text);
    for (const group of this.groups) {
      if (group.patterns.some((pattern) => pattern.test(normalized))) {
        return { reason: group.reason };
      }
    }
    return null;
  }

  private normalize(text: string) {
    return text
      .normalize('NFKC')
      .replace(/[0@]/g, 'o')
      .replace(/[1!]/g, 'i')
      .replace(/[3]/g, 'e')
      .replace(/[4]/g, 'a')
      .replace(/[5$]/g, 's')
      .toLowerCase();
  }
}
