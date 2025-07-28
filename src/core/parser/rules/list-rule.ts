import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class ListRule extends BufferingRule {
  readonly name = 'list';
  readonly priority = 4; // Higher priority than line breaks

  detect(chunk: string, _bufferState?: BufferState): boolean {
    // Detect both numbered lists (1. 2. etc.) and bulleted lists (- * +)
    return /^\s*(\d+\.|\-|\*|\+)\s/.test(chunk) || /\n\s*(\d+\.|\-|\*|\+)\s/.test(chunk);
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Check if this chunk contains a complete list
    const listPattern = /^(\s*(?:\d+\.|\-|\*|\+)\s[^\n]*(?:\n\s*(?:\d+\.|\-|\*|\+)\s[^\n]*)*)/m;
    const match = chunk.match(listPattern);
    
    if (match) {
      const [fullMatch] = match;
      const listItems = fullMatch.split('\n').filter(line => line.trim());
      
      // Determine if it's ordered or unordered
      const isOrdered = /^\s*\d+\./.test(listItems[0]);
      const listType = isOrdered ? 'ordered' : 'unordered';
      
      // Convert each line to a slotted list item
      const htmlItems = listItems.map(item => {
        const content = item.replace(/^\s*(?:\d+\.|\-|\*|\+)\s/, '').trim();
        return `    <li slot="items">${content}</li>`;
      }).join('\n');
      
      const replacement = `<list-viewer list-type="${listType}">
${htmlItems}
</list-viewer>`;
      
      return this.createCompleteMatch(fullMatch, fullMatch, replacement);
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
