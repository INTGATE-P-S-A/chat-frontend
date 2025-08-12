import { BufferState } from "../bufferer";

export interface CompleteMatchResult {
  match: boolean;
  fullMatch: string;
  content: string;
  replacement: string;
}

export interface BufferingResult {
  processedChunk: string;
  finisher?: string;
  closure: string;
}

export interface FullTextResult {
  pattern: RegExp;
  replacement: (match: string, ...groups: string[]) => string;
}

export abstract class BufferingRule {
  abstract readonly name: string;
  abstract readonly priority: number;

  abstract detect(chunk: string, bufferState?: BufferState): boolean | null;
  abstract tryCompleteMatch(chunk: string, bufferState?: BufferState): CompleteMatchResult | null;
  abstract startBuffering(chunk: string, bufferState?: BufferState): BufferingResult;
  
  /**
   * Continue buffering when we're in the middle of a rule's processing
   * Override this method to handle continuation of buffering with special logic
   */
  continueBuffering(_chunk: string, _currentBuffer: string, _finisher: string, _closure: string, _bufferState?: any): BufferingResult | null {
    return null; // Default: let the generic buffering logic handle it
  }

  /**
   * Handle completion of buffering when finisher is found
   * Override this method to handle special completion logic (like partial sequences)
   */
  handleBufferingCompletion(_chunk: string, _currentBuffer: string, _finisher: string, _closure: string, _bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    return null; // Default: let the generic buffering logic handle it
  }

  /**
   * Detect if buffering should finish based on the current chunk
   * Override this method when finisher is undefined in BufferingResult
   * @param chunk - Current chunk being processed
   * @param currentBuffer - Current buffer content
   * @param bufferState - Current buffer state
   * @returns true if buffering should finish, false otherwise
   */
  detectFinish(_chunk: string, _currentBuffer: string, _bufferState?: any): boolean | null {
    return false; // Default: don't finish buffering
  }

  /**
   * Extract and transform content that should be buffered
   * Override this method to process content before adding it to buffer
   */
  processBufferContent(content: string): string {
    return content; // Default: no transformation
  }
  
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
