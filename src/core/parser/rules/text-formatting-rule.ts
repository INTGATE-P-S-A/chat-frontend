import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class TextFormattingRule extends BufferingRule {
  readonly name = 'text-formatting';
  readonly priority = 5; // Same priority as old bold rule
  
  private partialMarker = ''; // Track partial * sequences across chunks
  private isProcessingBold = false; // Track if we're in bold mode

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial marker from previous chunks with current chunk
    const combinedChunk = this.partialMarker + chunk;
    
    // Check for ** (bold) first - higher priority
    if (combinedChunk.includes('**')) {
      this.partialMarker = '';
      this.isProcessingBold = true;
      return true;
    }
    
    // Check for single * (italic) but not part of **
    const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
    if (singleAsteriskPattern.test(combinedChunk)) {
      this.partialMarker = '';
      this.isProcessingBold = false;
      return true;
    }
    
    // Check for partial sequences at chunk boundaries
    if (chunk.endsWith('*')) {
      this.partialMarker = '*';
      return null; // Wait for next chunk to see if it's ** or just *
    }
    
    if (chunk.startsWith('*') && this.partialMarker === '*') {
      // We have ** from previous chunk ending with * and current starting with *
      this.partialMarker = '';
      this.isProcessingBold = true;
      return true;
    }
    
    // Reset partial marker if no match
    this.partialMarker = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Try bold first (**text**)
    const boldPattern = /\*\*([^*]+?)\*\*/g;
    const boldMatch = boldPattern.exec(chunk);
    
    if (boldMatch) {
      return {
        match: true,
        fullMatch: boldMatch[0],
        content: boldMatch[1],
        replacement: `<strong>${boldMatch[1]}</strong>`
      };
    }
    
    // Try italic (*text*) but avoid bold sequences
    const italicPattern = /(?<!\*)\*([^*\n]+?)\*(?!\*)/g;
    const italicMatch = italicPattern.exec(chunk);
    
    if (italicMatch) {
      return {
        match: true,
        fullMatch: italicMatch[0],
        content: italicMatch[1],
        replacement: `<em>${italicMatch[1]}</em>`
      };
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    let processedChunk = chunk;
    let finisher = '*';
    let closure = '</em>';
    
    if (this.isProcessingBold) {
      // Replace ** with <strong>
      processedChunk = chunk.replace(/\*\*/, '<strong>');
      finisher = '**';
      closure = '</strong>';
    } else {
      // Replace single * with <em>
      processedChunk = chunk.replace(/(?<!\*)\*(?!\*)/, '<em>');
      finisher = '*';
      closure = '</em>';
    }
    
    return {
      processedChunk,
      finisher,
      closure
    };
  }

  override detectFinish(chunk: string, _currentBuffer: string, _bufferState?: any): boolean {
    if (this.isProcessingBold) {
      // Look for closing ** 
      return chunk.includes('**');
    } else {
      // Look for closing * that's not part of **
      const closingPattern = /(?<!\*)\*(?!\*)/;
      return closingPattern.test(chunk);
    }
  }

  override continueBuffering(chunk: string, currentBuffer: string, finisher: string, closure: string, _bufferState?: any): BufferingResult | null {
    // Check if this chunk contains the finisher
    if (this.detectFinish(chunk, currentBuffer, _bufferState)) {
      return null; // Let the default completion logic handle it
    }
    
    // Continue buffering - pass through the chunk as-is
    return {
      processedChunk: chunk,
      finisher,
      closure
    };
  }

  override handleBufferingCompletion(chunk: string, _currentBuffer: string, _finisher: string, _closure: string, _bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    let finisherIndex = -1;
    
    if (this.isProcessingBold) {
      finisherIndex = chunk.indexOf('**');
    } else {
      // Find single * that's not part of **
      const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
      const match = singleAsteriskPattern.exec(chunk);
      if (match) {
        finisherIndex = match.index!;
      }
    }
    
    if (finisherIndex !== -1) {
      const finisherLength = this.isProcessingBold ? 2 : 1;
      const beforeFinisher = chunk.substring(0, finisherIndex);
      const afterFinisher = chunk.substring(finisherIndex + finisherLength);
      
      // Reset state
      this.isProcessingBold = false;
      this.partialMarker = '';
      
      return {
        finalChunk: beforeFinisher,
        remainingChunk: afterFinisher,
        shouldContinue: true
      };
    }
    
    // No finisher found - continue buffering
    return {
      finalChunk: chunk,
      remainingChunk: '',
      shouldContinue: true
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /(\*\*([^*]+?)\*\*)|(?<!\*)\*([^*\n]+?)\*(?!\*)/g,
      replacement: (match: string, boldFull: string, boldContent: string, italicContent: string) => {
        if (boldFull) {
          return `<strong>${boldContent}</strong>`;
        } else if (italicContent) {
          return `<em>${italicContent}</em>`;
        }
        return match;
      }
    };
  }
}