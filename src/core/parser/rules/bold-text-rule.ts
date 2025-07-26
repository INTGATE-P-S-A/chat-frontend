import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class BoldTextRule extends BufferingRule {
  readonly name = 'bold-text';
  readonly priority = 5;

  detect(chunk: string, _bufferState?: BufferState): boolean {
    return chunk.includes('**');
  }

  tryCompleteMatch(_chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Bold text always needs buffering for now
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    return {
      processedChunk: chunk.replace('**', '<strong>'),
      finisher: '**',
      closure: '</strong>'
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /\*\*(.*?)\*\*/g,
      replacement: (_match: string, language: string, content: string) => `<strong>${content}</strong>`
    };
  }
}
