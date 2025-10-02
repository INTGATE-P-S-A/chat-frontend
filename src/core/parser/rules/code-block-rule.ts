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
    // Simple pattern: ``` followed by language
    const codeBlockStart = chunk.match(/```([a-zA-Z][a-zA-Z0-9_-]*)?/);
    
    if (codeBlockStart) {
      if (bufferState) {
        bufferState.currentRule = 'code-block';
      }
      
      // If language is in the same chunk, start buffering
      if (codeBlockStart[1]) {
        return true;
      }
      
      // Wait for language in next chunk
      this.isDetectingLanguage = true;
      return null;
    }
    
    // Continue language detection
    if (this.isDetectingLanguage) {
      this.languageBuffer += chunk;
      
      const langMatch = this.languageBuffer.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\n/);
      if (langMatch) {
        this.isDetectingLanguage = false;
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

  startBuffering(chunk: string, _bufferState?: BufferState): BufferingResult {
    const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
    
    // Extract language from chunk or buffer
    let language = 'plaintext';
    if (this.languageBuffer) {
      const langMatch = this.languageBuffer.match(/^([a-zA-Z][a-zA-Z0-9_-]*)/);
      language = langMatch ? this.normalizeLanguage(langMatch[1]) : 'plaintext';
      this.languageBuffer = '';
    } else {
      const langMatch = chunk.match(/```([a-zA-Z][a-zA-Z0-9_-]*)/);
      language = langMatch ? this.normalizeLanguage(langMatch[1]) : 'plaintext';
    }
    
    const openTag = `<code-viewer componentId="${codeId}" language="${language}" streaming="true"></code-viewer>`;
    
    return {
      processedChunk: openTag,
      finisher: '```',
      closure: '</code-viewer>'
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
      
      if (bufferState) {
        bufferState.currentRule = undefined;
      }

      return {
        finalChunk: beforeFinisher,
        remainingChunk: afterFinisher,
        shouldContinue: true
      };
    }

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
