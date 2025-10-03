import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';
import voucher from 'voucher-code-generator';

export class CodeBlockRule extends BufferingRule {
  readonly name = 'code-block';
  readonly priority = 1; // Highest priority to detect code blocks before other formatting
  override readonly exclusiveBuffering = true;
  override readonly allowedRulesWhileBuffering: string[] = [];

  private languageBuffer = '';
  private isDetectingLanguage = false;
  private partialBackticks = ''; // Track partial ``` sequences across chunks

  detect(chunk: string, bufferState?: BufferState): boolean | null {
    // If we're already buffering, don't start a new code block - let detectFinish handle closing
    if (bufferState?.currentRule === 'code-block' && bufferState?.buffering) {
      return false; // Don't detect new code blocks while already buffering
    }
    
    // Combine any partial backticks from previous chunks
    const combinedChunk = this.partialBackticks + chunk;
    
    // Look for exactly ``` (three backticks) - not just any occurrence
    let searchIndex = 0;
    let codeBlockIndex = -1;
    
    while (searchIndex < combinedChunk.length) {
      const foundIndex = combinedChunk.indexOf('```', searchIndex);
      if (foundIndex === -1) {
        break; // No more ``` found
      }
      
      // Check if this is exactly ``` (not part of a longer sequence like `````)
      const beforeChar = foundIndex > 0 ? combinedChunk[foundIndex - 1] : '';
      const afterChar = foundIndex + 3 < combinedChunk.length ? combinedChunk[foundIndex + 3] : '';
      
      // Valid if:
      // - No backtick before (or start of chunk)
      // - No backtick after (or end of chunk) 
      if (beforeChar !== '`' && afterChar !== '`') {
        codeBlockIndex = foundIndex;
        break;
      }
      
      // Continue searching after this ``` sequence
      searchIndex = foundIndex + 3;
    }
    
    if (codeBlockIndex !== -1) {
      // Found valid ``` - calculate text before and after
      const textBefore = combinedChunk.substring(0, codeBlockIndex);
      const textAfter = combinedChunk.substring(codeBlockIndex + 3);
      
      // Clear partial backticks since we found complete ```
      this.partialBackticks = '';
      
      if (bufferState) {
        bufferState.currentRule = 'code-block';
        // Store text before ``` to be output before code-viewer
        if (textBefore) {
          bufferState.textBeforeCodeBlock = textBefore;
        }
      }
      
      // Check if language is in the same chunk after ```
      const langMatch = textAfter.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\n?(.*)$/s);
      if (langMatch && langMatch[1]) {
        // Language found in same chunk
        if (bufferState) {
          bufferState.detectedLanguage = langMatch[1];
          // Store content after language+newline for first buffer chunk
          if (langMatch[2]) {
            bufferState.contentAfterLanguage = langMatch[2];
          }
        }
        return true;
      }
      
      // Language not in same chunk - start language detection
      this.isDetectingLanguage = true;
      this.languageBuffer = textAfter;
      return null;
    }
    
    // Check for partial ``` sequences at chunk boundaries
    if (chunk.endsWith('``') || chunk.endsWith('`')) {
      // Might be start of ``` split across chunks
      if (chunk.endsWith('``')) {
        this.partialBackticks = '``';
      } else if (chunk.endsWith('`')) {
        this.partialBackticks = '`';
      }
      return null; // Wait for next chunk
    }
    
    // Clear partial backticks if no potential ``` found
    this.partialBackticks = '';
    
    // Continue language detection if we're in that mode
    if (this.isDetectingLanguage) {
      this.languageBuffer += chunk;
      
      const langMatch = this.languageBuffer.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\n?(.*)$/s);
      if (langMatch && langMatch[1]) {
        // Language found
        this.isDetectingLanguage = false;
        if (bufferState) {
          bufferState.detectedLanguage = langMatch[1];
          // Store content after language+newline for first buffer chunk
          if (langMatch[2]) {
            bufferState.contentAfterLanguage = langMatch[2];
          }
        }
        this.languageBuffer = '';
        return true;
      }
      
      return null;
    }
    
    return false;
  }

  tryCompleteMatch(chunk: string): CompleteMatchResult | null {
    // Find first valid ``` opening
    let openIndex = -1;
    let searchIndex = 0;
    
    while (searchIndex < chunk.length) {
      const foundIndex = chunk.indexOf('```', searchIndex);
      if (foundIndex === -1) break;
      
      const beforeChar = foundIndex > 0 ? chunk[foundIndex - 1] : '';
      const afterChar = foundIndex + 3 < chunk.length ? chunk[foundIndex + 3] : '';
      
      if (beforeChar !== '`' && afterChar !== '`') {
        openIndex = foundIndex;
        break;
      }
      
      searchIndex = foundIndex + 3;
    }
    
    if (openIndex === -1) return null;
    
    // Find matching closing ``` after the opening
    let closeIndex = -1;
    searchIndex = openIndex + 3;
    
    while (searchIndex < chunk.length) {
      const foundIndex = chunk.indexOf('```', searchIndex);
      if (foundIndex === -1) break;
      
      const beforeChar = foundIndex > 0 ? chunk[foundIndex - 1] : '';
      const afterChar = foundIndex + 3 < chunk.length ? chunk[foundIndex + 3] : '';
      
      if (beforeChar !== '`' && afterChar !== '`') {
        closeIndex = foundIndex;
        break;
      }
      
      searchIndex = foundIndex + 3;
    }
    
    if (closeIndex === -1) return null;
    
    // Extract the code block content
    const codeBlockContent = chunk.substring(openIndex + 3, closeIndex);
    const langMatch = codeBlockContent.match(/^(\w+)\n?([\s\S]*)$/);
    
    if (langMatch && langMatch[1]?.trim()) {
      const language = langMatch[1];
      const content = langMatch[2] || '';
      const fullMatch = chunk.substring(openIndex, closeIndex + 3);
      
      const normalizedLanguage = this.normalizeLanguage(language);
      const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
      const replacement = `<code-viewer componentId="${codeId}" language="${normalizedLanguage}" streaming="false">${content}</code-viewer>`;
      
      return this.createCompleteMatch(chunk, fullMatch, chunk.replace(fullMatch, replacement));
    }
    
    return null;
  }

  startBuffering(chunk: string, bufferState?: BufferState): BufferingResult {
    const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
    
    // Get language from bufferState or extract from chunk
    let language = 'plaintext';
    if (bufferState?.detectedLanguage) {
      language = this.normalizeLanguage(bufferState.detectedLanguage);
    } else {
      const langMatch = chunk.match(/```([a-zA-Z][a-zA-Z0-9_-]*)/);
      language = langMatch ? this.normalizeLanguage(langMatch[1]) : 'plaintext';
    }
    
    // Prepare output with text before code block (if any)
    let output = '';
    if (bufferState?.textBeforeCodeBlock) {
      output = bufferState.textBeforeCodeBlock;
      delete bufferState.textBeforeCodeBlock;
    }
    
    // Add the code-viewer opening tag
    const openTag = `<code-viewer componentId="${codeId}" language="${language}" streaming="true"></code-viewer>`;
    output += openTag;
    
    // Store info for first buffering chunk
    if (bufferState) {
      (bufferState as any).isFirstChunk = true;
    }
    
    return {
      processedChunk: output,
      finisher: '```',
      closure: '</code-viewer>'
    };
  }  override continueBuffering(chunk: string, _currentBuffer: string, finisher: string, closure: string, bufferState?: any): BufferingResult | null {
    if (closure !== '</code-viewer>') {
      return null;
    }
    
    let processedChunk = chunk;
    
    // Handle first buffering chunk - may need to include content after language
    if (bufferState?.isFirstChunk) {
      bufferState.isFirstChunk = false;
      
      if (bufferState.contentAfterLanguage) {
        processedChunk = bufferState.contentAfterLanguage + chunk;
        delete bufferState.contentAfterLanguage;
      }
    }
    
    return {
      processedChunk,
      finisher,
      closure
    };
  }

  override detectFinish(chunk: string, _currentBuffer: string, bufferState?: any): boolean {
    // Combine any partial backticks from previous chunks
    const combinedChunk = (bufferState?.partialClosingBackticks || '') + chunk;
    
    // Look for exactly ``` (three backticks) - not part of longer sequence
    let searchIndex = 0;
    
    while (searchIndex < combinedChunk.length) {
      const foundIndex = combinedChunk.indexOf('```', searchIndex);
      if (foundIndex === -1) {
        break; // No more ``` found
      }
      
      // Check if this is exactly ``` (not part of a longer sequence)
      const beforeChar = foundIndex > 0 ? combinedChunk[foundIndex - 1] : '';
      const afterChar = foundIndex + 3 < combinedChunk.length ? combinedChunk[foundIndex + 3] : '';
      
      // Valid if no backticks before or after
      if (beforeChar !== '`' && afterChar !== '`') {
        // Clear partial backticks since we found complete closing ```
        if (bufferState) {
          bufferState.partialClosingBackticks = '';
        }
        return true; // Found valid closing ```
      }
      
      // Continue searching after this ``` sequence
      searchIndex = foundIndex + 3;
    }
    
    // Check for partial ``` at end of chunk
    if (chunk.endsWith('``') || chunk.endsWith('`')) {
      if (bufferState) {
        if (chunk.endsWith('``')) {
          bufferState.partialClosingBackticks = '``';
        } else {
          bufferState.partialClosingBackticks = '`';
        }
      }
      return false; // Wait for more chunks
    }
    
    // Clear partial backticks if no potential ``` found
    if (bufferState) {
      bufferState.partialClosingBackticks = '';
    }
    
    return false;
  }

  override handleBufferingCompletion(chunk: string, _currentBuffer: string, finisher: string, closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    if (closure !== '</code-viewer>' || finisher !== '```') {
      return null;
    }

    // Combine any partial backticks from previous chunks
    const combinedChunk = (bufferState?.partialClosingBackticks || '') + chunk;

    // Find the first valid ``` (exactly three backticks, not part of longer sequence)
    let searchIndex = 0;
    let finisherIndex = -1;
    
    while (searchIndex < combinedChunk.length) {
      const foundIndex = combinedChunk.indexOf('```', searchIndex);
      if (foundIndex === -1) {
        break; // No more ``` found
      }
      
      // Check if this is exactly ``` (not part of a longer sequence)
      const beforeChar = foundIndex > 0 ? combinedChunk[foundIndex - 1] : '';
      const afterChar = foundIndex + 3 < combinedChunk.length ? combinedChunk[foundIndex + 3] : '';
      
      // Valid if no backticks before or after
      if (beforeChar !== '`' && afterChar !== '`') {
        finisherIndex = foundIndex;
        break;
      }
      
      // Continue searching after this ``` sequence
      searchIndex = foundIndex + 3;
    }
    
    if (finisherIndex !== -1) {
      // Calculate content before and after the closing ```
      const partialLength = bufferState?.partialClosingBackticks?.length || 0;
      
      const beforeFinisher = combinedChunk.substring(0, finisherIndex);
      const afterFinisher = combinedChunk.substring(finisherIndex + 3);
      
      // Clear rule state
      if (bufferState) {
        bufferState.currentRule = undefined;
        bufferState.partialClosingBackticks = '';
        delete bufferState.detectedLanguage;
        delete bufferState.contentAfterLanguage;
        delete bufferState.isFirstChunk;
      }
      
      // Clear instance state to prevent interference with remaining chunk processing
      this.partialBackticks = '';
      this.languageBuffer = '';
      this.isDetectingLanguage = false;

      return {
        finalChunk: beforeFinisher.substring(partialLength), // Remove partial backticks from final content
        remainingChunk: afterFinisher,
        shouldContinue: true
      };
    }

    // Check for partial ``` at end of chunk
    if (chunk.endsWith('``') || chunk.endsWith('`')) {
      if (bufferState) {
        if (chunk.endsWith('``')) {
          bufferState.partialClosingBackticks = '``';
        } else {
          bufferState.partialClosingBackticks = '`';
        }
      }
      
      // Return content without the partial backticks
      const contentLength = chunk.endsWith('``') ? chunk.length - 2 : chunk.length - 1;
      return {
        finalChunk: chunk.substring(0, contentLength),
        remainingChunk: '',
        shouldContinue: true
      };
    }

    // No finisher found - continue buffering
    if (bufferState) {
      bufferState.partialClosingBackticks = '';
    }
    
    return {
      finalChunk: chunk,
      remainingChunk: '',
      shouldContinue: true
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      // More precise pattern that looks for word boundaries around ```
      pattern: /(?:^|[^`])(```(\w+)?\n?([\s\S]*?)```)(?:[^`]|$)/g,
      replacement: (match: string, fullCodeBlock: string, language: string, content: string) => {
        const normalizedLanguage = language ? this.normalizeLanguage(language) : 'plaintext';
        const replacement = `<code-viewer language="${normalizedLanguage}">${content}</code-viewer>`;
        return match.replace(fullCodeBlock, replacement);
      }
    };
  }

  private readonly supportedLanguages = new Set([
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'c', 'cpp', 'c++',
    'csharp', 'cs', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
    'html', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml', 'sql',
    'bash', 'sh', 'shell', 'powershell', 'cmd', 'dockerfile', 'docker',
    'markdown', 'md', 'text', 'plaintext', 'diff', 'git', 'makefile',
    'r', 'matlab', 'perl', 'lua', 'haskell', 'clojure', 'erlang', 'elixir'
  ]);

  public normalizeLanguage(rawLanguage: string): string {
    if (!rawLanguage) return 'plaintext';
    
    const normalized = rawLanguage.toLowerCase().trim();
    
    if (this.supportedLanguages.has(normalized)) {
      return normalized;
    }
    
    const aliases: Record<string, string> = {
      'node': 'javascript',
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cs': 'csharp',
      'c++': 'cpp',
      'shell': 'bash',
      'sh': 'bash',
      'yml': 'yaml',
      'md': 'markdown'
    };
    
    if (aliases[normalized]) {
      return aliases[normalized];
    }
    
    if (/^[a-z][a-z0-9_-]*$/i.test(normalized)) {
      return normalized;
    }
    
    return 'plaintext';
  }
}
