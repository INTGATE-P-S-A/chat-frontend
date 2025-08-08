import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';
import voucher from 'voucher-code-generator';

export class CodeBlockRule extends BufferingRule {
  readonly name = 'code-block';
  readonly priority = 4;

  // Common programming languages for detection
  private readonly supportedLanguages = new Set([
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'c', 'cpp', 'c++',
    'csharp', 'cs', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
    'html', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml', 'sql',
    'bash', 'sh', 'shell', 'powershell', 'cmd', 'dockerfile', 'docker',
    'markdown', 'md', 'text', 'plaintext', 'diff', 'git', 'makefile',
    'r', 'matlab', 'perl', 'lua', 'haskell', 'clojure', 'erlang', 'elixir'
  ]);

  /**
   * Normalize and validate the detected language
   */

  detect(chunk: string, bufferState?: BufferState): boolean {
    // Don't detect if we're already inside a code-viewer tag
    if (bufferState?.insideCodeViewer || (bufferState?.codeViewerDepth && bufferState.codeViewerDepth > 0)) {
      return false;
    }
    
    // Don't detect if we're currently buffering any rule - this prevents nested code-viewer creation
    if (bufferState?.buffering) {
      return false;
    }
    
    // Check if we're inside an existing code-viewer tag by looking at the chunk content
    if (chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return false;
    }

    if(chunk.endsWith('```')) {      
      return true;
    }
    
    // Detect ``` at the beginning of a line or after whitespace 
    // Language might come in the same chunk or in subsequent chunks
    return /(?:^|\s)```/.test(chunk);
  }

  tryCompleteMatch(chunk: string, bufferState?: BufferState): CompleteMatchResult | null {
    // Don't process if we're already inside a code-viewer tag
    if (bufferState?.insideCodeViewer || (bufferState?.codeViewerDepth && bufferState.codeViewerDepth > 0)) {
      return null;
    }
    
    // Don't process if we're currently buffering any rule - this prevents nested code-viewer creation
    if (bufferState?.buffering) {
      return null;
    }
    
    // Check if we're inside an existing code-viewer tag by looking at the chunk content
    if (chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return null;
    }

    // Check for complete code block pattern in the chunk
    // Pattern: ```language\ncontent``` - only process if language is specified and ``` is at start of line
    const codeBlockMatch = chunk.match(/(?:^|\s)(```(\w+)\n?([\s\S]*?)```)/);
    if (codeBlockMatch) {
      const fullMatch = codeBlockMatch[1]; // The entire code block without leading whitespace
      const rawLanguage = codeBlockMatch[2];
      const content = codeBlockMatch[3];
      
      // Only create code-viewer if language is explicitly provided
      if (rawLanguage && rawLanguage.trim()) {
        const language = this.normalizeLanguage(rawLanguage);
        const codeId = voucher.generate({ count: 1 ,length:8 })[0].toLowerCase();
        const replacement = `<code-viewer componentId="${codeId}" language="${language}">${content}</code-viewer>`;
        
        // Find the position of the match in the chunk
        const matchIndex = chunk.indexOf(fullMatch);
        const beforeMatch = chunk.substring(0, matchIndex);
        const afterMatch = chunk.substring(matchIndex + fullMatch.length);
        
        const finalReplacement = beforeMatch + replacement + afterMatch;
        
        return this.createCompleteMatch(
          chunk,
          fullMatch,
          finalReplacement
        );
      }
    }
    
    return null;
  }

  startBuffering(chunk: string, bufferState?: BufferState): BufferingResult {
    // Don't start buffering if we're already inside a code-viewer tag
    if (bufferState?.insideCodeViewer || (bufferState?.codeViewerDepth && bufferState.codeViewerDepth > 0)) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }
    
    // Don't start buffering if we're currently buffering any rule - this prevents nested code-viewer creation
    if (bufferState?.buffering) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }
    
    // Check if we're inside an existing code-viewer tag by looking at the chunk content
    if (chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }

    // Extract content before the opening ``` (look for ``` at start of line or after whitespace)
    const backtickMatch = chunk.match(/(?:^|\s)(```)/);
    if (!backtickMatch) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }
    
    const backtickIndex = chunk.indexOf(backtickMatch[1]);
    const contentBefore = chunk.substring(0, backtickIndex);
    const contentAfterBackticks = chunk.substring(backtickIndex + 3);
    
    // Analyze the content after backticks to detect language
    let detectedLanguage = '';
    let codeContent = contentAfterBackticks;
    
    if (contentAfterBackticks.length > 0) {
      // Look for language followed by newline (standard format)
      const languageMatch = contentAfterBackticks.match(/^(\w+)\n/);
      if (languageMatch) {
        detectedLanguage = languageMatch[1];
        // Remove the language and newline from content - code starts after \n
        codeContent = contentAfterBackticks.substring(detectedLanguage.length + 1);
      } else {
        // Check if the entire chunk after ``` is just a language (waiting for \n in next chunk)
        const potentialLanguage = contentAfterBackticks.match(/^(\w+)$/);
        if (potentialLanguage && contentAfterBackticks.length <= 20) {
          // This is likely a language waiting for newline in next chunk
          detectedLanguage = potentialLanguage[1];
          codeContent = ''; // No code content yet, waiting for newline + code
        } else {
          // Check if we have partial language text that might continue in next chunk
          const partialLanguage = contentAfterBackticks.match(/^([a-zA-Z]+)$/);
          if (partialLanguage && contentAfterBackticks.length <= 15) {
            // This could be a partial language name, start language-waiting mode
            return {
              processedChunk: contentBefore,
              finisher: '\n', // Wait for newline that should complete the language + start code
              closure: `__TEMP_CODE_BLOCK_LANG_WAITING__${partialLanguage[1]}__` // Include partial language
            };
          } else {
            // Check if we have language followed by content without newline (edge case)
            const languageWithoutNewline = contentAfterBackticks.match(/^(\w+)(.*)$/);
            if (languageWithoutNewline && this.supportedLanguages.has(languageWithoutNewline[1].toLowerCase())) {
              detectedLanguage = languageWithoutNewline[1];
              codeContent = languageWithoutNewline[2];
            }
          }
        }
      }
    }

    // Handle case where ``` appears at the end of chunk with no language yet
    // We'll use a special buffering mode to wait for the language in the next chunk
    if (!detectedLanguage) {
      // Start special "language-waiting" buffering mode
      return {
        processedChunk: contentBefore,
        finisher: '\n', // Wait for newline that should come after language
        closure: `__TEMP_CODE_BLOCK_WAITING__` // Special marker to indicate we're waiting for language
      };
    }

    // Create opening tag with detected language
    const language = this.normalizeLanguage(detectedLanguage);
    const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
    const openTag = `<code-viewer componentId="${codeId}" language="${language}">`;
    
    // Return content before backticks as processed chunk, start buffering from code content
    return {
      processedChunk: contentBefore + openTag + codeContent,
      finisher: '```',
      closure: '</code-viewer>'
    };
  }

  /**
   * Handle continuation of buffering when we're waiting for language completion
   */
  continueBuffering(chunk: string, currentBuffer: string, finisher: string, closure: string): BufferingResult | null {
    // Handle language-waiting mode
    if (closure.startsWith('__TEMP_CODE_BLOCK_WAITING__')) {
      // Extract any partial language from the closure
      const partialLanguageMatch = closure.match(/__TEMP_CODE_BLOCK_LANG_WAITING__([a-zA-Z]+)__/);
      const partialLanguage = partialLanguageMatch ? partialLanguageMatch[1] : '';
      
      // Look for language completion in the current chunk
      let languageText = partialLanguage + chunk;
      
      // Find the newline that marks end of language
      const newlineIndex = languageText.indexOf('\n');
      if (newlineIndex !== -1) {
        const completeLanguage = languageText.substring(0, newlineIndex);
        const codeContent = languageText.substring(newlineIndex + 1);
        
        // Validate that we have a reasonable language name
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(completeLanguage) && completeLanguage.length <= 20) {
          const language = this.normalizeLanguage(completeLanguage);
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          const openTag = `<code-viewer componentId="${codeId}" language="${language}">`;
          
          // Switch to normal code buffering mode
          return {
            processedChunk: currentBuffer + openTag + codeContent,
            finisher: '```',
            closure: '</code-viewer>'
          };
        } else {
          // Invalid language, treat as plaintext
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          const openTag = `<code-viewer componentId="${codeId}" language="plaintext">`;
          
          return {
            processedChunk: currentBuffer + openTag + languageText,
            finisher: '```',
            closure: '</code-viewer>'
          };
        }
      } else {
        // Still waiting for newline, continue accumulating language
        if (languageText.length > 25) {
          // Too long to be a language, treat as plaintext and include everything as code
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          const openTag = `<code-viewer componentId="${codeId}" language="plaintext">`;
          
          return {
            processedChunk: currentBuffer + openTag + languageText,
            finisher: '```',
            closure: '</code-viewer>'
          };
        }
        
        // Continue waiting, update the partial language in closure
        return {
          processedChunk: currentBuffer,
          finisher: '\n',
          closure: `__TEMP_CODE_BLOCK_LANG_WAITING__${languageText}__`
        };
      }
    }
    
    return null; // Not handled by this rule, let parent handle
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

  // Make normalizeLanguage accessible for the full text pattern
  public normalizeLanguage(rawLanguage: string): string {
    if (!rawLanguage) return 'plaintext';
    
    const normalized = rawLanguage.toLowerCase().trim();
    
    // Direct match
    if (this.supportedLanguages.has(normalized)) {
      return normalized;
    }
    
    // Common aliases
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
    
    // Default fallback - preserve the original if it's a valid identifier
    if (/^[a-z][a-z0-9_-]*$/i.test(normalized)) {
      return normalized;
    }
    
    return 'plaintext';
  }
}
