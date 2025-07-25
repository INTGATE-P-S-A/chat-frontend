import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class LineBreakRule extends BufferingRule {
  readonly name = 'line-break';
  readonly priority = 10; // Lowest priority - process after all other rules

  detect(chunk: string, _bufferState?: BufferState): boolean {
    // Detect single newlines (but not if already in header buffering)
    return chunk.includes('\n');
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Always complete immediately - no need to buffer line breaks
    const lineBreakMatch = chunk.match(/(\n)/g);
    if (lineBreakMatch) {
      const replacement = chunk.replace(/\n/g, '<br/>');
      return this.createCompleteMatch(
        chunk,
        chunk,
        replacement
      );
    }
    return null;
  }

  startBuffering(_chunk: string): BufferingResult {
    // Line breaks should never buffer - they complete immediately
    throw new Error('LineBreakRule should never start buffering');
  }

  protected getFullTextPattern(): FullTextResult {
    return {
      pattern: /\n/g,
      replacement: (match: string, offset: number, string: string) => {
        // Don't replace newlines inside code-viewer tags
        const beforeMatch = string.substring(0, offset);
        const afterMatch = string.substring(offset);
        
        // Count open and closed code-viewer tags before this position
        const openTags = (beforeMatch.match(/<code-viewer[^>]*>/g) || []).length;
        const closeTags = (beforeMatch.match(/<\/code-viewer>/g) || []).length;
        
        // If we're inside a code-viewer tag, preserve the newline
        if (openTags > closeTags) {
          return '\n';
        }
        
        return '<br/>';
      }
    };
  }
}
