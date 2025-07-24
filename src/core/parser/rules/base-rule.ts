export interface CompleteMatchResult {
  match: boolean;
  fullMatch: string;
  content: string;
  replacement: string;
}

export interface BufferingResult {
  processedChunk: string;
  finisher: string;
  closure: string;
}

export abstract class BufferingRule {
  abstract readonly name: string;
  abstract readonly priority: number;

  abstract detect(chunk: string): boolean;
  abstract tryCompleteMatch(chunk: string): CompleteMatchResult | null;
  abstract startBuffering(chunk: string): BufferingResult;

  protected createCompleteMatch(
    fullMatch: string,
    content: string,
    replacement: string
  ): CompleteMatchResult {
    return {
      match: true,
      fullMatch,
      content,
      replacement
    };
  }
}
