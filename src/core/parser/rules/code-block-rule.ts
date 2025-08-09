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

    // Detect ``` - this can appear at any position in the chunk
    return chunk.includes('```');
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

    // Find the position of ``` in the chunk
    const backtickIndex = chunk.indexOf('```');
    if (backtickIndex === -1) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }
    
    const contentBefore = chunk.substring(0, backtickIndex);
    const contentAfterBackticks = chunk.substring(backtickIndex + 3);
    
    // Generate unique ID for the code-viewer
    const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
    
    // Always create code-viewer immediately with default language
    // We'll update the language later if we detect one
    let language = 'plaintext';
    let codeContent = contentAfterBackticks;
    
    // Try to detect language in the current chunk
    if (contentAfterBackticks.length > 0) {
      // Look for language followed by newline (standard format)
      const languageMatch = contentAfterBackticks.match(/^(\w+)\n/);
      if (languageMatch) {
        language = this.normalizeLanguage(languageMatch[1]);
        codeContent = contentAfterBackticks.substring(languageMatch[1].length + 1);
      } else {
        // Check if the entire chunk after ``` is just a language (waiting for \n)
        const potentialLanguage = contentAfterBackticks.match(/^(\w+)$/);
        if (potentialLanguage && contentAfterBackticks.length <= 20) {
          // We have a language, but no newline yet - still create the viewer
          language = this.normalizeLanguage(potentialLanguage[1]);
          codeContent = ''; // No code content yet
        } else {
          // Check for partial language
          const partialLanguage = contentAfterBackticks.match(/^([a-zA-Z]+)$/);
          if (partialLanguage && contentAfterBackticks.length <= 15) {
            // Potential partial language, use plaintext for now
            language = 'plaintext';
            codeContent = contentAfterBackticks; // Treat as content for now
          } else {
            // No clear language pattern, treat everything as code content
            language = 'plaintext';
            codeContent = contentAfterBackticks;
          }
        }
      }
    }
    
    // Create the code-viewer tag immediately
    const openTag = `<code-viewer componentId="${codeId}" language="${language}">`;
    const closeTag = '</code-viewer>';
    
    // Extract plain text content to put inside the tag initially
    const plainTextContent = this.extractPlainText(codeContent);
    
    console.log('✅ CODE_BLOCK_RULE: Creating code-viewer with ID:', codeId, 'language:', language);
    
    // Return the complete code-viewer tag with any initial content
    return {
      processedChunk: contentBefore + openTag + plainTextContent,
      finisher: '```',
      closure: closeTag
    };
  }

  /**
   * Extract plain text content from potentially HTML-containing text
   * This ensures only text content is passed inside code-viewer tags
   */
  private extractPlainText(content: string): string {
    if (!content) return content;
    
    // For code blocks, we want to preserve all text as-is, including any HTML-like content
    // The code-viewer component will handle proper escaping and display
    return content;
  }

  /**
   * Handle continuation of buffering for code block special cases
   */
  override continueBuffering(chunk: string, currentBuffer: string, _finisher: string, closure: string, _bufferState?: any): BufferingResult | null {
    // For normal code-viewer buffering (after opening tag was created)
    if (closure === '</code-viewer>') {
      // Handle partial ``` sequences from previous chunks
      const partialClosing = _bufferState?.partialClosing || '';
      const combinedChunk = partialClosing + chunk;
      
      // Check if combined chunk contains complete finisher ```
      if (combinedChunk.includes('```')) {
        console.log('🎯 CODE_BLOCK_RULE: Found complete ``` finisher (partial + chunk), returning null for completion');
        return null; // Let main completion logic handle it
      }
      
      // Check if current chunk ends with partial ` or `` for next chunk
      let newPartialClosing = '';
      if (chunk.endsWith('``')) {
        newPartialClosing = '``';
      } else if (chunk.endsWith('`')) {
        newPartialClosing = '`';
      }
      
      // Update buffer state with new partial sequence
      if (_bufferState) {
        _bufferState.partialClosing = newPartialClosing;
      }
      
      // Handle language detection if needed
      if (currentBuffer.includes('language="plaintext"') && chunk.match(/^[a-zA-Z]+\n?/)) {
        const languageMatch = chunk.match(/^([a-zA-Z]+)/);
        if (languageMatch) {
          const detectedLanguage = this.normalizeLanguage(languageMatch[1]);
          
          const componentIdMatch = currentBuffer.match(/componentId="([^"]+)"/);
          if (componentIdMatch) {
            const componentId = componentIdMatch[1];
            
            setTimeout(() => {
              const codeViewer = document.querySelector(`code-viewer[componentId="${componentId}"]`) as any;
              if (codeViewer) {
                codeViewer.language = detectedLanguage;
              }
            }, 0);
          }
          
          const contentWithoutLanguage = chunk.replace(/^[a-zA-Z]+\n?/, '');
          return {
            processedChunk: this.extractPlainText(contentWithoutLanguage),
            finisher: '```',
            closure: '</code-viewer>'
          };
        }
      }
      
      // Continue buffering - return chunk for updateRenderer
      return {
        processedChunk: this.extractPlainText(chunk),
        finisher: '```',
        closure: '</code-viewer>'
      };
    }
    
    // Handle legacy language-waiting mode (should be rare now)
    if (closure.startsWith('__TEMP_CODE_BLOCK_WAITING__') || closure.startsWith('__TEMP_CODE_BLOCK_LANG_WAITING__')) {
      // Extract any partial language from the closure
      const partialLanguageMatch = closure.match(/__TEMP_CODE_BLOCK_LANG_WAITING__([a-zA-Z]+)__/);
      const partialLanguage = partialLanguageMatch ? partialLanguageMatch[1] : '';
      
      // Look for language completion in the current chunk
      let languageText = partialLanguage + currentBuffer + chunk;
      
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
          
          // Switch to normal code buffering mode - ensure only plain text content
          const plainTextContent = this.extractPlainText(codeContent);
          return {
            processedChunk: openTag + plainTextContent,
            finisher: '```',
            closure: '</code-viewer>'
          };
        } else {
          // Invalid language, treat as plaintext
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          const openTag = `<code-viewer componentId="${codeId}" language="plaintext">`;
          
          const plainTextContent = this.extractPlainText(languageText);
          return {
            processedChunk: openTag + plainTextContent,
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
          
          const plainTextContent = this.extractPlainText(languageText);
          return {
            processedChunk: openTag + plainTextContent,
            finisher: '```',
            closure: '</code-viewer>'
          };
        }
        
        // Continue waiting, update the partial language in closure
        return {
          processedChunk: '',
          finisher: '\n',
          closure: `__TEMP_CODE_BLOCK_LANG_WAITING__${languageText}__`
        };
      }
    }
    
    return null; // Not handled by this rule, let parent handle
  }

  /**
   * Handle special completion logic for code blocks with partial ``` detection
   */
  override handleBufferingCompletion(chunk: string, currentBuffer: string, finisher: string, closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    console.log('🎯 CODE_BLOCK_RULE: handleBufferingCompletion called', { finisher, closure });
    
    // Only handle code-viewer completion
    if (closure !== '</code-viewer>' || finisher !== '```') {
      console.log('❌ CODE_BLOCK_RULE: Not handling completion - wrong finisher/closure');
      return null;
    }

    // Handle partial ``` sequences
    let partialClosing = bufferState?.partialClosing || '';
    let partialPlusChunk = partialClosing + chunk;
    
    // Check if the partial + chunk creates a complete ``` anywhere
    if (partialPlusChunk.includes('```')) {
      console.log('✅ CODE_BLOCK_RULE: Found complete ``` - completing code block');
      
      // Found complete ``` - END THE CODE BLOCK immediately
      const finisherIndex = partialPlusChunk.indexOf('```');
      const beforeFinisher = partialPlusChunk.substring(0, finisherIndex);
      const afterFinisher = partialPlusChunk.substring(finisherIndex + 3);
      
      // Since we're using updateRenderer for content, we don't need to include currentBuffer
      // Just send any remaining content before the ``` to updateRenderer and close the tag
      let finalChunk = '';
      if (beforeFinisher && !partialClosing) {
        // This content should go through updateRenderer, not be added to HTML
        // But for completion, we need to handle it here
        finalChunk = this.extractPlainText(beforeFinisher);
      }
      
      // Add the closing tag
      finalChunk += '</code-viewer>';
      
      // Call stopCodeGeneration on the component
      // Extract componentId from currentBuffer to find the component
      const componentIdMatch = currentBuffer.match(/componentId="([^"]+)"/);
      if (componentIdMatch) {
        const componentId = componentIdMatch[1];
        console.log('🛑 CODE_BLOCK_RULE: Attempting to call stopCodeGeneration for component:', componentId);
        
        setTimeout(() => {
          const codeViewer = document.querySelector(`code-viewer[componentId="${componentId}"]`) as any;
          if (codeViewer) {
            console.log('✅ CODE_BLOCK_RULE: Found code-viewer component, calling stopCodeGeneration');
            if (typeof codeViewer.stopCodeGeneration === 'function') {
              codeViewer.stopCodeGeneration();
              console.log('🎉 CODE_BLOCK_RULE: Successfully called stopCodeGeneration');
            } else {
              console.log('❌ CODE_BLOCK_RULE: stopCodeGeneration method not found on component');
            }
          } else {
            console.log('❌ CODE_BLOCK_RULE: Could not find code-viewer component with ID:', componentId);
          }
        }, 0);
      } else {
        console.log('❌ CODE_BLOCK_RULE: Could not extract componentId from currentBuffer');
      }
      
      return {
        finalChunk,
        remainingChunk: afterFinisher,
        shouldContinue: false
      };
    } else {
      // No complete ``` found yet, check if we have a new partial sequence
      const fullCurrentContent = currentBuffer + partialPlusChunk;
      
      let newPartialMatch = '';
      
      // Check for partial sequences at the very end: ` or ``
      if (fullCurrentContent.endsWith('``')) {
        newPartialMatch = '``';
      } else if (fullCurrentContent.endsWith('`')) {
        newPartialMatch = '`';
      }
      
      if (newPartialMatch) {
        // Found new partial sequence at end
        const contentBeforePartial = fullCurrentContent.substring(0, fullCurrentContent.length - newPartialMatch.length);
        
        // The buffer should contain everything except the partial sequence
        const bufferTextLength = currentBuffer.length;
        let contentToAdd = '';
        if (contentBeforePartial.length > bufferTextLength) {
          // Some content from this chunk should be added to buffer
          contentToAdd = contentBeforePartial.substring(bufferTextLength);
        }
        
        // Update buffer state with new partial
        if (bufferState) {
          bufferState.partialClosing = newPartialMatch;
        }
        
        return {
          finalChunk: this.extractPlainText(contentToAdd),
          remainingChunk: '',
          shouldContinue: true
        };
      } else {
        // No partial sequence detected, process content normally
        // If we had a partial sequence from before, it's not completing - include it as content
        let contentToProcess = chunk;
        if (partialClosing) {
          contentToProcess = partialClosing + chunk;
          if (bufferState) {
            bufferState.partialClosing = undefined;
          }
        }
        
        return {
          finalChunk: this.extractPlainText(contentToProcess),
          remainingChunk: '',
          shouldContinue: true
        };
      }
    }
  }

  /**
   * Process content for code-viewer buffering (ensure plain text)
   */
  override processBufferContent(content: string): string {
    return this.extractPlainText(content);
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
