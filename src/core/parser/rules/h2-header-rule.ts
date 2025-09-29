import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class H2HeaderRule extends BufferingRule {
  readonly name = 'h2-header';
  readonly priority = 1;
  
  private partialSequence = ''; // Track partial ## sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect ## at start of chunk or after newline, but not ### (more precise negative lookahead)
    const hasH2Marker = /(?:^|\n)##(?!#)/.test(combinedChunk);
    
    if (hasH2Marker) {
      this.partialSequence = ''; // Reset partial sequence
      return true;
    }
    
    // Check for partial sequences that could lead to ## headers
    // Handle cases where newline + # or newline + ## appears at end of chunk
    if (chunk.endsWith('\n#')) {
      this.partialSequence = '\n#';
      return null; // Wait for more chunks
    }
    if (chunk.endsWith('\n##')) {
      this.partialSequence = '\n##';
      return null; // Wait for more chunks  
    }
    // Check if chunk starts with # or ## and we have a pending newline
    if (this.partialSequence === '\n#' && chunk.startsWith('#') && !chunk.startsWith('###')) {
      this.partialSequence = '';
      return true;
    }
    if (this.partialSequence === '\n##') {
      this.partialSequence = '';
      return true;
    }
    
    // Reset partial sequence if no match
    this.partialSequence = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Combine partial sequence with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // First try to match complete header with single newline (most common in streaming)
    const singleNewlineMatch = combinedChunk.match(/(^|\n)(##\s*)(.*?)(\n)/);
    if (singleNewlineMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = singleNewlineMatch;
      // Only process if this is a complete header (not part of ###)
      if (!fullMatch.includes('###')) {
        return this.createCompleteMatch(
          fullMatch,
          headerContent,
          `${lineStart}<h2>${headerContent}</h2>${lineEnd}`
        );
      }
    }
    
    // Then try to match complete header with double newline
    const headerMatch = combinedChunk.match(/(^|\n)(##\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      // Only process if this is a complete header (not part of ###)
      if (!fullMatch.includes('###')) {
        return this.createCompleteMatch(
          fullMatch,
          headerContent,
          `${lineStart}<h2>${headerContent}</h2>${lineEnd}`
        );
      }
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
