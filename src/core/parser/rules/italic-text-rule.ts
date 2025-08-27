import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class ItalicTextRule extends BufferingRule {
  readonly name = 'italic-text';
  readonly priority = 7; // Lower priority than bold text so ** gets handled first
  
  private partialMarker = ''; // Track partial * sequences across chunks

  detect(chunk: string, bufferState?: BufferState): boolean | null {
    // Don't detect if we're currently buffering (avoid conflicts)
    if (bufferState?.buffering) {
      return false;
    }

    // Combine any partial marker from previous chunks with current chunk
    const combinedChunk = this.partialMarker + chunk;
    
    // Look for single * that's not part of ** (bold)
    // Be more careful about detecting italic vs bold markers
    const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
    
    if (singleAsteriskPattern.test(combinedChunk)) {
      // Check if this is really an italic marker (not part of bold)
      const match = combinedChunk.match(/(?<!\*)\*(?!\*)/);
      if (match) {
        // Make sure this isn't part of a ** sequence that got split
        const beforeAsterisk = combinedChunk.substring(0, match.index!);
        const afterAsterisk = combinedChunk.substring(match.index! + 1);
        
        // If the previous character or next character is *, this might be bold
        if (beforeAsterisk.endsWith('*') || afterAsterisk.startsWith('*')) {
          this.partialMarker = '';
          return false; // Let bold rule handle **
        }
        
        this.partialMarker = ''; // Reset partial marker
        return true;
      }
    }
    
    // Check for partial * at chunk boundaries
    if (chunk.endsWith('*')) {
      // This might be the start of ** or just a single *
      // Wait for next chunk to determine
      this.partialMarker = '*';
      return null; // Wait for more chunks
    }
    
    if (chunk.startsWith('*') && this.partialMarker === '*') {
      // We have ** from previous chunk ending with * and current starting with *
      this.partialMarker = '';
      return false; // This is bold, not italic
    }
    
    // Reset partial marker if no match
    this.partialMarker = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Try to find complete italic text pattern in chunk: *text*
    // But avoid matching bold text patterns like **text**
    const italicPattern = /(?<!\*)\*([^*\n]+?)\*(?!\*)/g;
    const match = italicPattern.exec(chunk);
    
    if (match) {
      return {
        match: true,
        fullMatch: match[0],
        content: match[1],
        replacement: `<em>${match[1]}</em>`
      };
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    // Find the single * and replace it with <em>
    const processedChunk = chunk.replace(/(?<!\*)\*(?!\*)/, '<em>');
    
    return {
      processedChunk,
      finisher: '*',
      closure: '</em>'
    };
  }

  override detectFinish(chunk: string, _currentBuffer: string, _bufferState?: any): boolean {
    // Look for closing * that's not part of **
    // Be more careful to avoid matching ** sequences
    const closingPattern = /(?<!\*)\*(?!\*)/;
    return closingPattern.test(chunk);
  }

  // Override continueBuffering to handle newlines properly within italic text
  override continueBuffering(chunk: string, currentBuffer: string, finisher: string, closure: string, _bufferState?: any): BufferingResult | null {
    // Check if this chunk contains the finisher (closing *)
    if (this.detectFinish(chunk, currentBuffer, _bufferState)) {
      return null; // Let the default completion logic handle it
    }
    
    // Continue buffering - just pass through the chunk as-is
    // This allows newlines and other content to be preserved within italic text
    return {
      processedChunk: chunk,
      finisher,
      closure
    };
  }

  // Override handleBufferingCompletion to properly handle the closing *
  override handleBufferingCompletion(chunk: string, currentBuffer: string, _finisher: string, closure: string, _bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    const asteriskPattern = /(?<!\*)\*(?!\*)/;
    const match = asteriskPattern.exec(chunk);
    
    if (match) {
      const finisherIndex = match.index!;
      const contentBeforeFinisher = chunk.substring(0, finisherIndex);
      const remainingChunk = chunk.substring(finisherIndex + 1);
      
      // Build the final italic element
      const finalChunk = currentBuffer + contentBeforeFinisher + closure;
      
      return {
        finalChunk,
        remainingChunk,
        shouldContinue: false
      };
    }
    
    return null;
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      // Pattern to match *text* but not **text**, allowing newlines within
      pattern: /(?<!\*)\*([^*]+?)\*(?!\*)/g,
      replacement: (_match: string, content: string) => `<em>${content}</em>`
    };
  }
}
