import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';
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
}
