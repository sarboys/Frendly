import { Buffer } from 'node:buffer';

export interface CursorInput {
  value: string;
  [key: string]: unknown;
}

export function encodeCursor(input: CursorInput): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string | null): CursorInput | null {
  if (!cursor) {
    return null;
  }

  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorInput;
}
