import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class ListRule extends BufferingRule {
  readonly name = 'list';
  readonly priority = 4; // Higher priority than line breaks
  
  private partialMarker = ''; // Track partial list markers across chunks

  detect(chunk: string, bufferState?: BufferState): boolean | null {
    // Don't detect if we're already inside a list-viewer tag
    if (bufferState?.insideListViewer || (bufferState?.listViewerDepth && bufferState.listViewerDepth > 0)) {
      return false;
    }
    
    // Don't detect if we're currently buffering any rule
    if (bufferState?.buffering) {
      return false;
    }
    
    // Check if we're inside an existing list-viewer tag by looking at the chunk content
    if (chunk.includes('<list-viewer') && !chunk.includes('</list-viewer>')) {
      return false;
    }
    
    // Combine any partial marker from previous chunks with current chunk
    const combinedChunk = this.partialMarker + chunk;
    
    // More strict list detection - must be at line start or after newline with proper spacing
    // Also ensure we don't match inside bold text or other markdown
    const listMarkerPattern = /(?:^|\n)\s*(\d+\.|\-|\*|\+)\s+\S/;
    const hasListMarker = listMarkerPattern.test(combinedChunk);
    
    if (hasListMarker) {
      // Additional validation: ensure this isn't inside bold text or other markdown
      const match = combinedChunk.match(listMarkerPattern);
      if (match) {
        const beforeMatch = combinedChunk.substring(0, match.index);
        // Don't trigger if we're inside bold text (unclosed **)
        const boldMarkers = (beforeMatch.match(/\*\*/g) || []).length;
        if (boldMarkers % 2 === 0) { // Even number means we're not inside bold text
          this.partialMarker = ''; // Reset partial marker
          return true;
        }
      }
    }
    
    // Check for partial list markers at the end of chunk (more conservative)
    const partialNumberMatch = chunk.match(/(\n\s*\d+\.?)$/);
    const partialBulletMatch = chunk.match(/(\n\s*[\-\*\+])$/);
    
    if (partialNumberMatch && partialNumberMatch[1].includes('.')) {
      this.partialMarker = partialNumberMatch[1];
      return null; // Wait for more chunks
    } else if (partialBulletMatch) {
      this.partialMarker = partialBulletMatch[1];
      return null; // Wait for more chunks
    } else {
      this.partialMarker = '';
    }
    
    return false;
  }

  tryCompleteMatch(chunk: string, bufferState?: BufferState): CompleteMatchResult | null {
    // Don't process if we're already inside a list-viewer tag
    if (bufferState?.insideListViewer || (bufferState?.listViewerDepth && bufferState.listViewerDepth > 0)) {
      return null;
    }
    
    // Don't process if we're currently buffering any rule
    if (bufferState?.buffering) {
      return null;
    }
    
    // Check if we're inside an existing list-viewer tag by looking at the chunk content
    if (chunk.includes('<list-viewer') && !chunk.includes('</list-viewer>')) {
      return null;
    }
    
    // Check if this chunk contains a complete list with proper boundaries
    // More strict pattern that requires proper list structure
    const listPattern = /(?:^|\n)(\s*(?:\d+\.|\-|\*|\+)\s+[^\n]+(?:\n\s*(?:\d+\.|\-|\*|\+)\s+[^\n]+)*)/;
    const match = chunk.match(listPattern);
    
    if (match) {
      const [fullMatch, listContent] = match;
      const listItems = listContent.split('\n').filter(line => line.trim());
      
      // Additional validation: ensure each line is a proper list item
      const validItems = listItems.filter(item => /^\s*(?:\d+\.|\-|\*|\+)\s+\S/.test(item));
      if (validItems.length === 0) {
        return null; // No valid list items found
      }
      
      // Check that we're not breaking up other markdown (like bold text)
      const beforeMatch = chunk.substring(0, match.index!);
      const boldMarkers = (beforeMatch.match(/\*\*/g) || []).length;
      if (boldMarkers % 2 !== 0) { // Odd number means we're inside bold text
        return null;
      }
      
      // Determine if it's ordered or unordered
      const isOrdered = /^\s*\d+\./.test(validItems[0]);
      const listType = isOrdered ? 'ordered' : 'unordered';
      
      // Convert each line to a slotted list item, preserving formatting
      const htmlItems = validItems.map(item => {
        const content = item.replace(/^\s*(?:\d+\.|\-|\*|\+)\s+/, '').trim();
        // Ensure content is properly escaped for HTML attributes but preserve markup
        return `    <li slot="items">${content}</li>`;
      }).join('\n');
      
      // Create clean list-viewer without any extra attributes
      const replacement = `<list-viewer list-type="${listType}">
${htmlItems}
</list-viewer>`;
      
      return this.createCompleteMatch(fullMatch, listContent, replacement);
    }
    
    return null;
  }

  startBuffering(chunk: string, bufferState: BufferState): BufferingResult {
    // Don't start buffering if we're already inside a list-viewer tag
    if (bufferState?.insideListViewer || (bufferState?.listViewerDepth && bufferState.listViewerDepth > 0)) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }
    
    // Start buffering when we detect a list item
    const listStart = chunk.match(/^(.*?)(\s*(?:\d+\.|\-|\*|\+)\s.*)/);
    if (listStart) {
      const [, before, listPart] = listStart;
      
      // Set linebreak proof to prevent line breaks from being converted to <br> tags
      bufferState.linebreakProof = true;
      bufferState.insideListViewer = true;
      bufferState.listViewerDepth = (bufferState.listViewerDepth || 0) + 1;
      
      return {
        processedChunk: before,
        finisher: '\n\n', // End list when we get two newlines
        closure: listPart
      };
    }
    
    return {
      processedChunk: chunk,
      finisher: '\n\n',
      closure: ''
    };
  }

  /**
   * Handle completion of buffering when finisher is found
   */
  override handleBufferingCompletion(chunk: string, currentBuffer: string, finisher: string, closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    // Reset list viewer state when buffering completes
    if (bufferState) {
      bufferState.insideListViewer = false;
      bufferState.listViewerDepth = Math.max(0, (bufferState.listViewerDepth || 1) - 1);
      bufferState.linebreakProof = false;
      bufferState.buffering = false; // Ensure buffering is properly reset
    }
    
    return null; // Let default logic handle the rest
  }

  /**
   * Detect if list should finish based on content patterns
   */
  override detectFinish(chunk: string, currentBuffer: string, bufferState?: BufferState): boolean {
    // If we encounter double newlines, the list should finish
    if (chunk.includes('\n\n')) {
      return true;
    }
    
    // If we encounter content that's not a list item after a newline, finish the list
    const nonListContent = /\n[^\s]*[^0-9\-\*\+\.\s]/.test(chunk);
    if (nonListContent) {
      return true;
    }
    
    return false;
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /^(\s*(?:\d+\.|\-|\*|\+)\s[^\n]*(?:\n\s*(?:\d+\.|\-|\*|\+)\s[^\n]*)*)/gm,
      replacement: (match: string) => {
        const listItems = match.split('\n').filter(line => line.trim());
        
        // Determine if it's ordered or unordered
        const isOrdered = /^\s*\d+\./.test(listItems[0]);
        const listType = isOrdered ? 'ordered' : 'unordered';
        
        // Convert each line to a slotted list item
        const htmlItems = listItems.map(item => {
          const content = item.replace(/^\s*(?:\d+\.|\-|\*|\+)\s/, '').trim();
          return `    <li slot="items">${content}</li>`;
        }).join('\n');
        
        return `<list-viewer list-type="${listType}">
${htmlItems}
</list-viewer>`;
      }
    };
  }
}
