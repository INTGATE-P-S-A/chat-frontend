import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class LinkRule extends BufferingRule {
  readonly name = 'link';
  readonly priority = 6;
  
  private partialSequence = ''; // Track partial link sequences across chunks

  /**
   * Check if a URL at a given position is inside an HTML tag or attribute
   */
  private isInsideHtmlTag(text: string, urlStartIndex: number): boolean {
    // Find the nearest < before the URL
    let openIndex = -1;
    for (let i = urlStartIndex - 1; i >= 0; i--) {
      if (text[i] === '>') {
        // Found closing tag before URL - URL is not inside a tag
        return false;
      }
      if (text[i] === '<') {
        openIndex = i;
        break;
      }
    }
    
    if (openIndex === -1) {
      return false; // No opening tag found
    }
    
    // Find the nearest > after the URL start
    let closeIndex = -1;
    for (let i = urlStartIndex; i < text.length; i++) {
      if (text[i] === '<') {
        // Found another opening tag before closing - URL is not inside the first tag
        return false;
      }
      if (text[i] === '>') {
        closeIndex = i;
        break;
      }
    }
    
    if (closeIndex === -1) {
      // No closing tag found, but we found an opening tag before the URL
      // This could be an unclosed tag, assume URL is inside
      return true;
    }
    
    // URL is between < and > - it's inside a tag
    return true;
  }

  /**
   * Check if any URLs in the text are already inside HTML tags/attributes
   */
  private hasValidUrls(text: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+/g;
    let match;
    
    while ((match = urlPattern.exec(text)) !== null) {
      const urlStartIndex = match.index;
      if (!this.isInsideHtmlTag(text, urlStartIndex)) {
        return true; // Found at least one URL that's not inside a tag
      }
    }
    
    return false; // All URLs are inside tags or no URLs found
  }

  detect(chunk: string, _bufferState?: BufferState): boolean | null {
    // Combine any partial sequence from previous chunks with current chunk
    const combinedChunk = this.partialSequence + chunk;
    
    // Detect markdown-style links [text](url) or plain URLs
    const hasLinkMarker = combinedChunk.includes('[') || combinedChunk.includes('](') || /https?:\/\//.test(combinedChunk);
    
    if (hasLinkMarker) {
      // Check if we have a complete link pattern and if URLs are not inside HTML tags
      const hasCompleteMarkdown = /\[([^\]]+)\]\(([^)]+)\)/.test(combinedChunk);
      const hasValidUrls = this.hasValidUrls(combinedChunk);
      
      if (hasCompleteMarkdown || hasValidUrls) {
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
      const matchIndex = chunk.indexOf(fullMatch);
      
      // Check if this markdown link is not already inside an HTML tag
      if (!this.isInsideHtmlTag(chunk, matchIndex)) {
        const replacement = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        return this.createCompleteMatch(fullMatch, linkText, replacement);
      }
    }

    // Check for plain URLs
    const urlPattern = /(https?:\/\/[^\s]+)/;
    const urlMatch = chunk.match(urlPattern);
    
    if (urlMatch) {
      const [fullMatch, url] = urlMatch;
      const matchIndex = chunk.indexOf(fullMatch);
      
      // Check if this URL is not already inside an HTML tag
      if (!this.isInsideHtmlTag(chunk, matchIndex)) {
        const replacement = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        return this.createCompleteMatch(fullMatch, url, replacement);
      }
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
      replacement: (match: string, ...args: string[]) => {
        // args contains: [markdownLink, linkText, markdownUrl, plainUrl, offset, fullString]
        const offset = parseInt(args[args.length - 2]); // Second to last arg is offset
        const fullString = args[args.length - 1]; // Last arg is full string
        
        // Check if this match is inside an HTML tag/attribute
        if (!isNaN(offset) && fullString && this.isInsideHtmlTag(fullString, offset)) {
          return match; // Return original match without modification
        }
        
        const linkText = args[1];
        const markdownUrl = args[2];
        const plainUrl = args[3];
        
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
