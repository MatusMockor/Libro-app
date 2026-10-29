export const HANDLE_SUFFIX_SOURCE = Symbol('HANDLE_SUFFIX_SOURCE');

export interface HandleSuffixSource {
  digits(length: number): string;
}
