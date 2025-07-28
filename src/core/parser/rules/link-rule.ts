import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class LinkRule extends BufferingRule {
  readonly name = 'link';
  readonly priority = 6;

  detect(chunk: string, _bufferState?: BufferState): boolean {
    // Detect markdown-style links [text](url) or plain URLs
    return chunk.includes('[') || chunk.includes('](') || /https?:\/\//.test(chunk);
  }

  tryCompleteMatch(chunk: string, _bufferState?: BufferState): CompleteMatchResult | null {
    // Check for complete markdown link pattern in the chunk
    const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/;
    const markdownMatch = chunk.match(markdownLinkPattern);
    
    if (markdownMatch) {
      const [fullMatch, linkText, url] = markdownMatch;
      const replacement = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      
      return this.createCompleteMatch(fullMatch, linkText, replacement);
    }

    // Check for plain URLs
    const urlPattern = /(https?:\/\/[^\s]+)/;
    const urlMatch = chunk.match(urlPattern);
    
    if (urlMatch) {
      const [fullMatch, url] = urlMatch;
      const replacement = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      
      return this.createCompleteMatch(fullMatch, url, replacement);
    }
    
    return null;
  }

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    // Start buffering when we find the opening bracket
    const openBracketIndex = chunk.indexOf('[');
    if (openBracketIndex !== -1) {
      const before = chunk.substring(0, openBracketIndex);
      const after = chunk.substring(openBracketIndex + 1);
      
      return {
        processedChunk: before,
        finisher: ')',
        closure: after
      };
    }
    
    return {
      processedChunk: chunk,
      finisher: ')',
      closure: ''
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      // Match both markdown links [text](url) and plain URLs
      pattern: /(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s]+)/g,
      replacement: (match: string, _markdownLink: string, linkText?: string, markdownUrl?: string, plainUrl?: string) => {
        if (markdownUrl && linkText) {
          // Markdown link format
          return `<a href="${markdownUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        } else if (plainUrl) {
          // Plain URL format
          return `<a href="${plainUrl}" target="_blank" rel="noopener noreferrer">${plainUrl}</a>`;
        }
        return match;
      }
    };
  }
}
