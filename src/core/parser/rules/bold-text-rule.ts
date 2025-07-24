import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';

export class BoldTextRule extends BufferingRule {
  readonly name = 'bold-text';
  readonly priority = 5;

  detect(chunk: string): boolean {
    return chunk.includes('**');
  }

  tryCompleteMatch(_chunk: string): CompleteMatchResult | null {
    // Bold text always needs buffering for now
    return null;
  }

  startBuffering(chunk: string): BufferingResult {
    return {
      processedChunk: chunk.replace('**', '<strong>'),
      finisher: '**',
      closure: '</strong>'
    };
  }
}
