import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';

export class LineBreakRule extends BufferingRule {
  readonly name = 'line-break';
  readonly priority = 10; // Lowest priority - process after all other rules

  detect(chunk: string, bufferState?: BufferState): boolean {
    // Don't detect line breaks if we're in a linebreak-proof context (code-viewer or list-viewer)
    if (bufferState?.linebreakProof) {
      return false;
    }
    
    // Don't detect if code-block rule is currently active (even if not buffering yet)
    if (bufferState?.currentRule === 'code-block') {
      return false;
    }
    
    // Don't process chunks that contain code block patterns that code-block rule should handle
    if (this.containsCodeBlockPattern(chunk)) {
      return false;
    }
    
    // Don't detect if we're inside code-viewer or list-viewer components
    if (bufferState?.insideCodeViewer || bufferState?.insideListViewer) {
      return false;
    }
    
    // Don't detect if we're currently buffering any rule - let the buffering rule handle line breaks
    if (bufferState?.buffering) {
      return false;
    }
    
    // Don't detect if code-block rule is currently active (even if not buffering yet)
    if (bufferState?.currentRule === 'code-block') {
      return false;
    }
    
    // Don't process chunks that contain code block patterns that code-block rule should handle
    if (this.containsCodeBlockPattern(chunk)) {
      return false;
    }
    
    // Check if we're inside an existing code-viewer or list-viewer tag by looking at the chunk content
    if (chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return false;
    }
    
    if (chunk.includes('<list-viewer') && !chunk.includes('</list-viewer>')) {
      return false;
    }
    
    // Detect single newlines only if we're not in any protected context
    return chunk.includes('\n');
  }

  tryCompleteMatch(chunk: string, bufferState?: BufferState): CompleteMatchResult | null {
    // Don't process line breaks if we're in a linebreak-proof context (code-viewer or list-viewer)
    if (bufferState?.linebreakProof) {
      return null;
    }
    
    // Don't process if we're inside code-viewer or list-viewer components
    if (bufferState?.insideCodeViewer || bufferState?.insideListViewer) {
      return null;
    }
    
    // Don't process if we're currently buffering any rule - let the buffering rule handle line breaks
    if (bufferState?.buffering) {
      return null;
    }
    
    // Don't process if code-block rule is currently active (even if not buffering yet)
    if (bufferState?.currentRule === 'code-block') {
      return null;
    }
    
    // Don't process chunks that contain code block patterns that code-block rule should handle
    if (this.containsCodeBlockPattern(chunk)) {
      return null;
    }
    
    // Check if we're inside an existing code-viewer or list-viewer tag by looking at the chunk content
    if (chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return null;
    }
    
    if (chunk.includes('<list-viewer') && !chunk.includes('</list-viewer>')) {
      return null;
    }
    
    // Always complete immediately - no need to buffer line breaks
    const lineBreakMatch = chunk.match(/(\n)/g);
    if (lineBreakMatch) {
      // Smart replacement - avoid adding <br/> after certain elements
      const replacement = chunk.replace(/\n/g, (_match, offset) => {
        const beforeNewline = chunk.substring(0, offset);
        
        // Don't add <br/> after closing </li> tags
        if (/<\/li>\s*$/.test(beforeNewline)) {
          return '\n';
        }
        
        // Don't add <br/> after closing </code-viewer> tags
        if (/<\/code-viewer>\s*$/.test(beforeNewline)) {
          return '\n';
        }
        
        // Don't add <br/> after closing </list-viewer> tags
        if (/<\/list-viewer>\s*$/.test(beforeNewline)) {
          return '\n';
        }
        
        // Don't add <br/> after opening <li> tags (list items handle their own spacing)
        if (/<li[^>]*>\s*$/.test(beforeNewline)) {
          return '\n';
        }
        
        // Don't add <br/> after opening component tags
        if (/<(?:code-viewer|list-viewer)[^>]*>\s*$/.test(beforeNewline)) {
          return '\n';
        }
        
        // Default: convert newline to <br/>
        return '\n';
      });
      
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

  /**
   * Check if chunk contains patterns that should be handled by code-block rule
   * This prevents line-break rule from processing chunks before code-block rule can detect them
   */
  private containsCodeBlockPattern(chunk: string): boolean {
    // Only skip if chunk actually contains ``` pattern
    if (chunk.includes('```')) {
      return true;
    }
    
    return false;
  }

  override processFullText(text: string): string {
    // Don't process line breaks inside code-viewer or list-viewer components
    
    // Split by code-viewer and list-viewer components to avoid processing content inside them
    const componentPattern = /(<(?:code-viewer|list-viewer)[^>]*>[\s\S]*?<\/(?:code-viewer|list-viewer)>)/g;
    const parts: string[] = [];
    let lastIndex = 0;
    let match;
    
    // Find all component blocks
    while ((match = componentPattern.exec(text)) !== null) {
      // Add text before the component (process line breaks here with smart logic)
      if (match.index > lastIndex) {
        const beforeComponent = text.substring(lastIndex, match.index);
        parts.push(this.smartLineBreakReplacement(beforeComponent));
      }
      
      // Add the component as-is (don't process line breaks inside)
      parts.push(match[1]);
      lastIndex = match.index + match[1].length;
    }
    
    // Add remaining text after last component (process line breaks here with smart logic)
    if (lastIndex < text.length) {
      const afterComponents = text.substring(lastIndex);
      parts.push(this.smartLineBreakReplacement(afterComponents));
    }
    
    return parts.join('');
  }

  private smartLineBreakReplacement(text: string): string {
    return text.replace(/\n/g, (_, offset) => {
      const beforeNewline = text.substring(0, offset);
      
      // Don't add <br/> after closing </li> tags
      if (/<\/li>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Don't add <br/> after closing </code-viewer> tags
      if (/<\/code-viewer>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Don't add <br/> after closing </list-viewer> tags
      if (/<\/list-viewer>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Don't add <br/> after opening <li> tags (list items handle their own spacing)
      if (/<li[^>]*>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Don't add <br/> after opening component tags
      if (/<(?:code-viewer|list-viewer)[^>]*>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Don't add <br/> after closing tags that should manage their own spacing
      if (/<\/(?:ol|ul|div|p|h[1-6])\s*>\s*$/.test(beforeNewline)) {
        return '\n';
      }
      
      // Default: convert newline to <br/>
      return '';
    });
  }

  protected override getFullTextPattern(dontBreak = false): FullTextResult {
    return {
      pattern: /\n/g,
      replacement: (_match: string) => {
        if (dontBreak) {
          return '\n';
        }
        
        return '\n';
      }
    };
  }
}
