import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class H3HeaderRule extends BufferingRule {
  readonly name = 'h3-header';
  readonly priority = 2;
  
  private partialSequence = ''; // Track partial ### sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect ### at start of chunk or after newline
    const hasH3Marker = /(?:^|\n)###/.test(combinedChunk);
    
    if (hasH3Marker) {
      this.partialSequence = ''; // Reset partial sequence
      return true;
    }
    
    // Check for partial sequences that could lead to ### headers
    // Handle cases where newline + # or newline + ## or newline + ### appears at end of chunk
    if (chunk.endsWith('\n#')) {
      this.partialSequence = '\n#';
      return null; // Wait for more chunks
    }
    if (chunk.endsWith('\n##')) {
      this.partialSequence = '\n##';
      return null; // Wait for more chunks  
    }
    if (chunk.endsWith('\n###')) {
      this.partialSequence = '\n###';
      return null; // Wait for more chunks  
    }
    
    // Check if chunk completes a ### sequence
    if (this.partialSequence === '\n#' && chunk.startsWith('##')) {
      this.partialSequence = '';
      return true;
    }
    if (this.partialSequence === '\n##' && chunk.startsWith('#')) {
      this.partialSequence = '';
      return true;
    }
    if (this.partialSequence === '\n###') {
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
    const singleNewlineMatch = combinedChunk.match(/(^|\n)(###\s*)(.*?)(\n)/);
    if (singleNewlineMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = singleNewlineMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h3>${headerContent}</h3>${lineEnd}`
      );
    }
    
    // Then try to match complete header with double newline
    const headerMatch = combinedChunk.match(/(^|\n)(###\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h3>${headerContent}</h3>${lineEnd}`
      );
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    return {
      processedChunk: chunk.replace(/(^|\n)###(\s*)/, '$1<h3>'),
      finisher: '\n',
      closure: '</h3>'
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /^### (.+)$/gm,
      replacement: (_match: string, content: string) => `<h3>${content}</h3>`
    };
  }
}
