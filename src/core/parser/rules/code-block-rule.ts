import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';
import voucher from 'voucher-code-generator';

export class CodeBlockRule extends BufferingRule {
  readonly name = 'code-block';
  readonly priority = 5;
  override readonly exclusiveBuffering = true;
  override readonly allowedRulesWhileBuffering: string[] = [];

  private languageBuffer = '';
  private isDetectingLanguage = false;

  detect(chunk: string, bufferState?: BufferState): boolean | null {
    // Check for ``` pattern anywhere in chunk
    const codeBlockIndex = chunk.indexOf('```');
    
    if (codeBlockIndex !== -1) {
      // Found ``` - preserve content before it
      const textBefore = chunk.substring(0, codeBlockIndex);
      const textAfter = chunk.substring(codeBlockIndex + 3);
      
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
    const codeBlockMatch = chunk.match(/(```(\w+)\n?([\s\S]*?)```)/);
    if (codeBlockMatch) {
      const fullMatch = codeBlockMatch[1];
      const language = codeBlockMatch[2];
      const content = codeBlockMatch[3];
      
      if (language?.trim()) {
        const normalizedLanguage = this.normalizeLanguage(language);
        const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
        const replacement = `<code-viewer componentId="${codeId}" language="${normalizedLanguage}" streaming="false">${content}</code-viewer>`;
        
        return this.createCompleteMatch(chunk, fullMatch, chunk.replace(fullMatch, replacement));
      }
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

  override detectFinish(chunk: string): boolean {
    return chunk.includes('```');
  }

  override handleBufferingCompletion(chunk: string, _currentBuffer: string, finisher: string, closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    if (closure !== '</code-viewer>' || finisher !== '```') {
      return null;
    }

    const finisherIndex = chunk.indexOf('```');
    if (finisherIndex !== -1) {
      const beforeFinisher = chunk.substring(0, finisherIndex);
      const afterFinisher = chunk.substring(finisherIndex + 3);
      
      // Clear rule state
      if (bufferState) {
        bufferState.currentRule = undefined;
        delete bufferState.detectedLanguage;
        delete bufferState.contentAfterLanguage;
        delete bufferState.isFirstChunk;
      }

      return {
        finalChunk: beforeFinisher,
        remainingChunk: afterFinisher,
        shouldContinue: true
      };
    }

    // No finisher found - continue buffering
    return {
      finalChunk: chunk,
      remainingChunk: '',
      shouldContinue: true
    };
  }

  protected override getFullTextPattern(): FullTextResult {
    return {
      pattern: /```(\w+)?\n?([\s\S]*?)```/g,
      replacement: (_match: string, language: string, content: string) => {
        const normalizedLanguage = language ? this.normalizeLanguage(language) : 'plaintext';
        return `<code-viewer language="${normalizedLanguage}">${content}</code-viewer>`;
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
