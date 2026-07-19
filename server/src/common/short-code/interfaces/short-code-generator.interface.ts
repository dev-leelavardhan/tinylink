export interface ShortCodeGenerateOptions {
  originalUrl: string;
  /** 1-based collision retry attempt; used by non-deterministic / hash strategies */
  attempt?: number;
}

export interface ShortCodeGenerator {
  generate(options: ShortCodeGenerateOptions): Promise<string> | string;
}
