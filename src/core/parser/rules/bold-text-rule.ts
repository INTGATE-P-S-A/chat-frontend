import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class BoldTextRule extends BufferingRule {
  readonly name = 'bold-text';
  readonly priority = 5;
  
  private partialMarker = ''; // Track partial ** sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    console.log('Bold Text Rule - detect called with chunk:', JSON.stringify(chunk.substring(0, 100)));
    console.log('Bold pre checking', { chunk })

    console.log('Bold checking', { chunk })

    // Combine any partial marker from previous chunks with current chunk
    const combinedChunk = this.partialMarker + chunk;
    
    // Check for any ** sequence in combined chunk (simplified detection)
    if (combinedChunk.includes('**')) {
      this.partialMarker = ''; // Reset partial marker
      return true;
    }
    
    // Check for partial ** sequence at chunk boundaries
    if (chunk.endsWith('*') && !this.partialMarker) {
      // This might be the first * of **
      this.partialMarker = '*';
      return null; // Wait for more chunks
    }
    
    if (chunk.startsWith('*') && this.partialMarker === '*') {
      // We have ** from previous chunk ending with * and current starting with *
      this.partialMarker = '';
      return true; // This is bold
    }
    
    // Reset partial marker if no match
    this.partialMarker = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Check if there are any complete bold text patterns in the chunk
    const boldPattern = /\*\*([^*]+?)\*\*/;
    const match = boldPattern.exec(chunk);
    
    if (match) {
      // Return the first match for detection, but the replacement will handle all instances
      return {
        match: true,
        fullMatch: match[0],
        content: match[1],
        replacement: `<strong>${match[1]}</strong>`
      };
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    // Replace the opening ** with <strong>
    const processedChunk = chunk.replace(/\*\*/, '<strong>');
    
    return {
      processedChunk,
      finisher: '**',
      closure: '</strong>'
    };
  }

  // Override continueBuffering to handle newlines properly within bold text
  override continueBuffering(chunk: string, _currentBuffer: string, finisher: string, closure: string, _bufferState?: any): BufferingResult | null {
    // Check if this chunk contains the finisher (closing **)
    if (chunk.includes(finisher)) {
      return null; // Let the default completion logic handle it
    }
    
    // Continue buffering - just pass through the chunk as-is
    // This allows newlines and other content to be preserved within bold text
    return {
      processedChunk: chunk,
      finisher,
      closure
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /\*\*(.*?)\*\*/g,
      replacement: (_match: string, content: string) => `<strong>${content}</strong>`
    };
  }
}
