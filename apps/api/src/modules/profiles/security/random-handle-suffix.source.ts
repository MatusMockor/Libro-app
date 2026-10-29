import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { HandleSuffixSource } from '../application/handle-suffix-source.js';

const DECIMAL_DIGITS = 10;

@Injectable()
export class RandomHandleSuffixSource implements HandleSuffixSource {
  digits(length: number): string {
    return Array.from({ length }, () => String(randomInt(DECIMAL_DIGITS))).join('');
  }
}
