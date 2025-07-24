import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';

export class CodeBlockRule extends BufferingRule {
  readonly name = 'code-block';
  readonly priority = 4;

  detect(chunk: string): boolean {
    return chunk.includes('```');
  }

  tryCompleteMatch(_chunk: string): CompleteMatchResult | null {
    // Code blocks always need buffering for proper handling
    return null;
  }

  startBuffering(chunk: string): BufferingResult {
    return {
      processedChunk: chunk,
      finisher: '```',
      closure: '```'
    };
  }
}
