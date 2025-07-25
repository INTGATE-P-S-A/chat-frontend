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

export interface FullTextResult {
  pattern: RegExp;
  replacement: (match: string, ...groups: string[]) => string;
}

export abstract class BufferingRule {
  abstract readonly name: string;
  abstract readonly priority: number;

  abstract detect(chunk: string, bufferState?: any): boolean;
  abstract tryCompleteMatch(chunk: string, bufferState?: any): CompleteMatchResult | null;
  abstract startBuffering(chunk: string, bufferState?: any): BufferingResult;
  
  /**
   * Process full text with regex patterns (for non-streaming scenarios)
   * Override this method to provide full-text processing for each rule
   */
  processFullText(text: string): string {
    const fullTextResult = this.getFullTextPattern();
    if (fullTextResult) {
      return text.replace(fullTextResult.pattern, fullTextResult.replacement);
    }
    return text;
  }

  /**
   * Get the full text pattern for this rule
   * Override this method to provide regex patterns for full text processing
   */
  protected getFullTextPattern(): FullTextResult | null {
    return null;
  }

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
