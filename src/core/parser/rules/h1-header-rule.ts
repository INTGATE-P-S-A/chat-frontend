import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';

export class H1HeaderRule extends BufferingRule {
  readonly name = 'h1-header';
  readonly priority = 3;

  detect(chunk: string): boolean {
    return chunk.includes('#') && !chunk.includes('##');
  }

  tryCompleteMatch(chunk: string): CompleteMatchResult | null {
    const headerMatch = chunk.match(/(^|\n)(#\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h1>${headerContent}</h1>${lineEnd}`
      );
    }
    return null;
  }

  startBuffering(chunk: string): BufferingResult {
    return {
      processedChunk: chunk.replace(/(^|\n)#\s*/, '$1<h1>'),
      finisher: '\n\n',
      closure: '</h1>'
    };
  }
}
