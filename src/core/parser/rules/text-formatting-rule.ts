import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class TextFormattingRule extends BufferingRule {
  readonly name = 'text-formatting';
  readonly priority = 5;
  
  private partialMarker = ''; // Track partial * sequences across chunks
  private bufferingType: 'bold' | 'italic' | null = null;

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Don't detect new formatting while already buffering
    if (_bufferState?.currentRule === 'text-formatting' && _bufferState?.buffering) {
      return false;
    }

    // Combine any partial marker from previous chunks with current chunk
    const combinedChunk = this.partialMarker + chunk;
    
    // Check for ** (bold) first - higher priority
    if (combinedChunk.includes('**')) {
      this.partialMarker = '';
      return true;
    }
    
    // Check for single * (italic) but not part of **
    const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
    if (singleAsteriskPattern.test(combinedChunk)) {
      this.partialMarker = '';
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
      return true;
    }
    
    // Reset partial marker if no match
    this.partialMarker = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Check if we have both complete and incomplete patterns
    const hasCompletePatterns = this.hasCompletePatterns(chunk);
    const hasIncompletePatterns = this.hasIncompletePatterns(chunk);
    
    if (hasCompletePatterns && hasIncompletePatterns) {
      // We have both complete and incomplete patterns - return null so buffering can start
      return null;
    }
    
    if (hasCompletePatterns) {
      // Only complete patterns - return the first one for normal processing
      const boldPattern = /\*\*([^*]+?)\*\*/g;
      const firstBoldMatch = boldPattern.exec(chunk);
      if (firstBoldMatch) {
        return {
          match: true,
          fullMatch: firstBoldMatch[0],
          content: firstBoldMatch[1],
          replacement: `<strong>${firstBoldMatch[1]}</strong>`
        };
      }
      
      const italicPattern = /(?<!\*)\*([^*\n]+?)\*(?!\*)/g;
      const firstItalicMatch = italicPattern.exec(chunk);
      if (firstItalicMatch) {
        return {
          match: true,
          fullMatch: firstItalicMatch[0],
          content: firstItalicMatch[1],
          replacement: `<em>${firstItalicMatch[1]}</em>`
        };
      }
    }
    
    return null;
  }

  startBuffering(chunk: string, bufferState?: BufferState): BufferingResult {
    // Find the position of the opening marker for incomplete patterns
    let markerIndex = -1;
    let markerLength = 0;
    
    // Look for incomplete bold patterns first (**text without closing **)
    const incompletePattern = /\*\*([^*]*?)$/;
    const boldMatch = incompletePattern.exec(chunk);
    if (boldMatch) {
      markerIndex = boldMatch.index!;
      markerLength = 2;
      this.bufferingType = 'bold';
    } else {
      // Check for ** first (bold) - fallback to any **
      const boldIndex = chunk.indexOf('**');
      if (boldIndex !== -1) {
        markerIndex = boldIndex;
        markerLength = 2;
        this.bufferingType = 'bold';
      } else {
        // Check for single * (italic) that's not part of **
        const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
        const match = singleAsteriskPattern.exec(chunk);
        if (match) {
          markerIndex = match.index!;
          markerLength = 1;
          this.bufferingType = 'italic';
        }
      }
    }
    
    // Text before the marker gets output immediately
    const textBeforeMarker = chunk.substring(0, markerIndex);
    // Content after the marker needs to be buffered
    const contentAfterMarker = chunk.substring(markerIndex + markerLength);
    
    // Store content after marker to be processed in first continueBuffering call
    if (bufferState && contentAfterMarker) {
      (bufferState as any).contentAfterMarker = contentAfterMarker;
      (bufferState as any).isFirstBufferingChunk = true;
    }
    
    const finisher = this.bufferingType === 'bold' ? '**' : '*';
    const closure = this.bufferingType === 'bold' ? '</strong>' : '</em>';
    const openTag = this.bufferingType === 'bold' ? '<strong>' : '<em>';
    
    // Output the text before marker + opening tag
    const immediateOutput = textBeforeMarker + openTag;
    
    return {
      processedChunk: immediateOutput,
      finisher,
      closure
    };
  }

  override detectFinish(chunk: string, _currentBuffer: string, bufferState?: any): boolean {
    let chunkToCheck = chunk;
    
    // If this is the first buffering chunk and we have content after marker, combine them
    if (bufferState?.isFirstBufferingChunk && bufferState?.contentAfterMarker) {
      chunkToCheck = bufferState.contentAfterMarker + chunk;
    }
    
    if (this.bufferingType === 'bold') {
      return chunkToCheck.includes('**');
    } else {
      // Look for closing * that's not part of **
      const closingPattern = /(?<!\*)\*(?!\*)/;
      return closingPattern.test(chunkToCheck);
    }
  }

  override continueBuffering(chunk: string, _currentBuffer: string, finisher: string, closure: string, bufferState?: any): BufferingResult | null {
    let processedChunk = chunk;
    
    // Handle content that was after the opening marker in the first chunk
    if (bufferState?.isFirstBufferingChunk) {
      bufferState.isFirstBufferingChunk = false;
      
      if (bufferState?.contentAfterMarker) {
        processedChunk = bufferState.contentAfterMarker + chunk;
        delete bufferState.contentAfterMarker;
      }
    }
    
    // Check if this processed chunk contains the finisher
    if (this.detectFinish(processedChunk, _currentBuffer, bufferState)) {
      // Store the processed chunk for handleBufferingCompletion to use
      if (bufferState) {
        (bufferState as any).finalChunkToProcess = processedChunk;
      }
      return null; // Let handleBufferingCompletion handle it
    }
    
    // Continue buffering - pass through the processed chunk
    return {
      processedChunk,
      finisher,
      closure
    };
  }

  override handleBufferingCompletion(chunk: string, _currentBuffer: string, _finisher: string, _closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    // Use the processed chunk if available, otherwise fall back to the original chunk
    let chunkToProcess = bufferState?.finalChunkToProcess || chunk;
    
    // CRITICAL FIX: If we have contentAfterMarker that wasn't processed yet, prepend it
    if (bufferState?.contentAfterMarker) {
      chunkToProcess = bufferState.contentAfterMarker + chunkToProcess;
      delete bufferState.contentAfterMarker;
    }
    
    let finisherIndex = -1;
    
    if (this.bufferingType === 'bold') {
      finisherIndex = chunkToProcess.indexOf('**');
    } else {
      // Find single * that's not part of **
      const singleAsteriskPattern = /(?<!\*)\*(?!\*)/;
      const match = singleAsteriskPattern.exec(chunkToProcess);
      if (match) {
        finisherIndex = match.index!;
      }
    }
    
    if (finisherIndex !== -1) {
      const finisherLength = this.bufferingType === 'bold' ? 2 : 1;
      const beforeFinisher = chunkToProcess.substring(0, finisherIndex);
      const afterFinisher = chunkToProcess.substring(finisherIndex + finisherLength);
      
      // Clean up stored state
      if (bufferState?.finalChunkToProcess) {
        delete bufferState.finalChunkToProcess;
      }
      if (bufferState?.isFirstBufferingChunk) {
        delete bufferState.isFirstBufferingChunk;
      }
      
      // Reset state
      this.bufferingType = null;
      this.partialMarker = '';
      
      return {
        finalChunk: beforeFinisher,
        remainingChunk: afterFinisher,
        shouldContinue: true
      };
    }
    
    // No finisher found - this shouldn't happen if detectFinish returned true
    return {
      finalChunk: chunkToProcess,
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

  private hasCompletePatterns(chunk: string): boolean {
    // Check for complete bold patterns
    const boldPattern = /\*\*([^*]+?)\*\*/g;
    if (boldPattern.test(chunk)) {
      return true;
    }
    
    // Check for complete italic patterns
    const italicPattern = /(?<!\*)\*([^*\n]+?)\*(?!\*)/g;
    if (italicPattern.test(chunk)) {
      return true;
    }
    
    return false;
  }

  private hasIncompletePatterns(chunk: string): boolean {
    // Check for incomplete bold patterns (**text without closing **)
    const incompleteBoldPattern = /\*\*([^*]*?)$/;
    if (incompleteBoldPattern.test(chunk)) {
      return true;
    }
    
    // Check for incomplete italic patterns (*text without closing *)
    const incompleteItalicPattern = /(?<!\*)\*([^*\n]*?)$/;
    if (incompleteItalicPattern.test(chunk)) {
      return true;
    }
    
    return false;
  }
}