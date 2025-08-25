import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class ListRule extends BufferingRule {
  readonly name = 'list';
  readonly priority = 4; // Higher priority than line breaks
  
  private partialMarker = ''; // Track partial list markers across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
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

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
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
        return `    <li slot="items">${content}</li>`;
      }).join('\n');
      
      const replacement = `<list-viewer list-type="${listType}">
${htmlItems}
</list-viewer>`;
      
      return this.createCompleteMatch(fullMatch, listContent, replacement);
    }
    
    return null;
  }

  startBuffering(chunk: string, bufferState: BufferState): BufferingResult {
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
