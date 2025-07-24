import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';

export class H3HeaderRule extends BufferingRule {
  readonly name = 'h3-header';
  readonly priority = 1;

  detect(chunk: string): boolean {
    return chunk.includes('###') || /^###\s/.test(chunk);
  }

  tryCompleteMatch(chunk: string): CompleteMatchResult | null {
    const headerMatch = chunk.match(/(^|\n)(###\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h3>${headerContent}</h3>${lineEnd}`
      );
    }
    return null;
  }

  startBuffering(chunk: string): BufferingResult {
    return {
      processedChunk: chunk.replace(/(^|\n)###\s*/, '$1<h3>'),
      finisher: '\n\n',
      closure: '</h3>'
    };
  }
}
