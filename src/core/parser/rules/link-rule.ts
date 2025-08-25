import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class LinkRule extends BufferingRule {
  readonly name = 'link';
  readonly priority = 6;
  
  private partialSequence = ''; // Track partial link sequences across chunks

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect markdown-style links [text](url) or plain URLs
    const hasLinkMarker = combinedChunk.includes('[') || combinedChunk.includes('](') || /https?:\/\//.test(combinedChunk);
    
    if (hasLinkMarker) {
      // Check if we have a complete link pattern
      if (/\[([^\]]+)\]\(([^)]+)\)/.test(combinedChunk) || /https?:\/\/[^\s]+/.test(combinedChunk)) {
        this.partialSequence = ''; // Reset partial sequence
        return true;
      }
    }
    
    // Check for partial link sequences at the end of chunk
    const partialLinkMatch = chunk.match(/(\[[^\]]*|\]\([^)]*)$/);
    const partialUrlMatch = chunk.match(/(https?:\/\/[^\s]*)$/);
    
    if (partialLinkMatch && partialLinkMatch[1].length > 1) {
      this.partialSequence = partialLinkMatch[1];
      return null; // Wait for more chunks
    } else if (partialUrlMatch && partialUrlMatch[1].length > 7) { // "http://" is 7 chars
      this.partialSequence = partialUrlMatch[1];
      return null; // Wait for more chunks
    } else {
      this.partialSequence = '';
    }
    
    return false;
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
