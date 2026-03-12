import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class HeaderRule extends BufferingRule {
  readonly name = 'header';
  readonly priority = 1; // High priority to process headers before other text formatting
  
  private partialSequence = ''; // Track partial # sequences across chunks
  private detectedLevel = 0; // Track the detected header level

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect any # character anywhere in the text
    const hasHeaderMarker = /#/.test(combinedChunk);
    
    if (hasHeaderMarker) {
      this.partialSequence = ''; // Reset partial sequence
      return true;
    }
    
    // Reset partial sequence if no match
    this.partialSequence = '';
    return false;
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Combine partial sequence with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Match header patterns: capture the # sequence and content until newline or end
    const headerMatch = combinedChunk.match(/(#{1,6})\s*([^#\n]*?)(?:\n|$)/);
    if (headerMatch) {
      const [fullMatch, hashSequence, headerContent] = headerMatch;
      const headerLevel = hashSequence.length; // Count the # characters
      const trimmedContent = headerContent.trim();
      
      if (trimmedContent && headerLevel >= 1 && headerLevel <= 6) {
        // Store the detected level for potential buffering
        this.detectedLevel = headerLevel;
        
        return this.createCompleteMatch(
          fullMatch,
          trimmedContent,
          `<h${headerLevel}>${trimmedContent}</h${headerLevel}>`
        );
      }
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    // Count the # characters at the start to determine header level
    const hashMatch = chunk.match(/^(#{1,6})/);
    const headerLevel = hashMatch ? hashMatch[1].length : this.detectedLevel || 1;
    
    // Store the level for closure
    this.detectedLevel = headerLevel;
    
    return {
      processedChunk: chunk.replace(/^(#{1,6}\s*)/, `<h${headerLevel}>`),
      finisher: '\n',
      closure: `</h${headerLevel}>`
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /^(#{1,6})\s+(.+)$/gm,
      replacement: (_match: string, hashes: string, content: string) => {
        const level = hashes.length;
        return `<h${level}>${content}</h${level}>`;
      }
    };
  }
}