import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class BoldTextRule extends BufferingRule {
  readonly name = 'bold-text';
  readonly priority = 5;
  
  private partialSequence = ''; // Track partial ** sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Check for complete ** sequence in combined chunk
    // But be more careful about detecting opening vs closing markers
    const boldPattern = /\*\*(?!\s)/; // ** not followed by whitespace
    if (boldPattern.test(combinedChunk)) {
      this.partialSequence = ''; // Reset partial sequence
      return true;
    }
    
    // Check for partial ** sequence at the end of the chunk (more conservative)
    if (chunk.endsWith('*') && !chunk.endsWith('**')) {
      this.partialSequence = '*';
      return null; // Wait for more chunks
    } else {
      this.partialSequence = '';
    }
    
    return false;
  }

  tryCompleteMatch(_chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Bold text always needs buffering for now
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    return {
      processedChunk: chunk.replace('**', '<strong>'),
      finisher: '**',
      closure: '</strong>'
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /\*\*(.*?)\*\*/g,
      replacement: (_match: string, content: string) => `<strong>${content}</strong>`
    };
  }
}
