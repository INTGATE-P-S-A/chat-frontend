import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class H2HeaderRule extends BufferingRule {
  readonly name = 'h2-header';
  readonly priority = 2;

  detect(chunk: string, _bufferState?: BufferState): boolean {
    // Detect ## at start of chunk or after newline, with optional space, but not ###
    return /(?:^|\n)##(?!#)(\s|$)/.test(chunk) || /(?:^|\n)##(?!#)/.test(chunk);
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // First try to match complete header with single newline (most common in streaming)
    const singleNewlineMatch = chunk.match(/(^|\n)(##\s*)(.*?)(\n)/);
    if (singleNewlineMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = singleNewlineMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h2>${headerContent}</h2>${lineEnd}`
      );
    }
    
    // Then try to match complete header with double newline
    const headerMatch = chunk.match(/(^|\n)(##\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h2>${headerContent}</h2>${lineEnd}`
      );
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    return {
      processedChunk: chunk.replace(/(^|\n)##(\s*)/, '$1<h2>'),
      finisher: '\n',
      closure: '</h2>'
    };
  }

  protected getFullTextPattern(): FullTextResult {
    return {
      pattern: /^## (.+)$/gm,
      replacement: (match: string, content: string) => `<h2>${content}</h2>`
    };
  }
}
