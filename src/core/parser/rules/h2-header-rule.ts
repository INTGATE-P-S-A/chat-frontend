import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class H2HeaderRule extends BufferingRule {
  readonly name = 'h2-header';
  readonly priority = 2;
  
  private partialSequence = ''; // Track partial ## sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect ## at start of chunk or after newline, with optional space, but not ###
    const hasH2Marker = /(?:^|\n)##(?!#)(\s|$)/.test(combinedChunk) || /(?:^|\n)##(?!#)/.test(combinedChunk);
    
    if (hasH2Marker) {
      this.partialSequence = ''; // Reset partial sequence
      return true;
    }
    
    // Check for partial ## sequence at the end of chunk (after newline)
    const partialMatch = chunk.match(/(\n#{1,2})$/);
    if (partialMatch && partialMatch[1].length > 1) {
      this.partialSequence = partialMatch[1];
      return null; // Wait for more chunks
    } else {
      this.partialSequence = '';
    }
    
    return false;
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

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /^## (.+)$/gm,
      replacement: (_match: string, content: string) => `<h2>${content}</h2>`
    };
  }
}
