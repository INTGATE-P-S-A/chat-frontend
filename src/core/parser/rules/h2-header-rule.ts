import { BufferingRule, CompleteMatchResult, BufferingResult } from './base-rule';

export class H2HeaderRule extends BufferingRule {
  readonly name = 'h2-header';
  readonly priority = 2;

  detect(chunk: string): boolean {
    return ((chunk.includes('##') && !chunk.includes('###')) || 
            (/^##\s/.test(chunk) && !chunk.includes('###')));
  }

  tryCompleteMatch(chunk: string): CompleteMatchResult | null {
    const headerMatch = chunk.match(/(^|\n)(##\s*)(.*?)(\n\n)/);
    if (headerMatch) {
      const [fullMatch, lineStart, , headerContent, lineEnd] = headerMatch;
      return this.createCompleteMatch(
        fullMatch,
        headerContent,
        `${lineStart}<h2>${headerContent}</h2>${lineEnd}`
      );
    }
    return null;
  }

  startBuffering(chunk: string): BufferingResult {
    return {
      processedChunk: chunk.replace(/(^|\n)##\s*/, '$1<h2>'),
      finisher: '\n\n',
      closure: '</h2>'
    };
  }
}
