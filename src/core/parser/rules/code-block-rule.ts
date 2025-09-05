import { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';
import { BufferState } from '../bufferer';
import voucher from 'voucher-code-generator';

export class CodeBlockRule extends BufferingRule {
  readonly name = 'code-block';
  readonly priority = 4;

  constructor() {
    super();
  }

  private openingCheck = '';  
  private languageCheck = '';
  private detectedLanguage = '';
  private languageDetectionMode = false;

  private static createdCodeViewers = new Set<string>(); // Track created code-viewer IDs

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
   * Check if we should skip processing due to existing code-viewer context
   */
  private shouldSkipProcessing(bufferState?: BufferState, chunk?: string): boolean {
    // Don't process if we're already inside a code-viewer tag
    if (bufferState?.insideCodeViewer || (bufferState?.codeViewerDepth && bufferState.codeViewerDepth > 0)) {
      return true;
    }
    
    // Don't process if we're currently buffering any rule - prevents nested code-viewer creation
    if (bufferState?.buffering) {
      return true;
    }
    
    // Don't process if we have ANY existing code-viewer in the current context
    if (bufferState?.currentCodeViewerId) {
      return true;
    }
    
    // Check if we're inside an existing code-viewer tag by looking at the chunk content
    if (chunk && chunk.includes('<code-viewer') && !chunk.includes('</code-viewer>')) {
      return true;
    }
    
    return false;
  }

  /**
   * Normalize and validate the detected language
   */

  detect(chunk: string, bufferState?: BufferState): boolean | null {
    // if (this.shouldSkipProcessing(bufferState, chunk)) {
    //  
    //   return false;
    // }

    if(this.checkLang(chunk, bufferState)){
        return true;
    }

    // Handle opening check for ``` sequence across chunks
    if(this.openingCheck !== '```' && chunk.includes('`') && !chunk.endsWith('```')){
      this.openingCheck += chunk;
      return null;
    }    

    if(this.openingCheck !== '' && this.openingCheck.length >= 3){
      if(this.openingCheck.includes('```')){        
        // Found ``` in accumulated chunks - extract text before ``` for preservation
        const tripleBacktickIndex = this.openingCheck.indexOf('```');
        const textBeforeCodeBlock = this.openingCheck.substring(0, tripleBacktickIndex);
        const textAfterTripleBacktick = this.openingCheck.substring(tripleBacktickIndex + 3);
        
        // Store text that should be preserved before code block starts
        if (textBeforeCodeBlock && bufferState) {
          bufferState.textBeforeCodeBlock = textBeforeCodeBlock;
        }
                
        // Start language detection phase with remaining content
        this.languageCheck = textAfterTripleBacktick;

        if(this.languageCheck !== ''){
          this.detectedLanguage = this.languageCheck;
          this.languageDetectionMode = false;
          this.openingCheck = '';
          return true;
        }

        this.detectedLanguage = '';
        this.languageDetectionMode = true;
        // return null; // Don't start buffering yet, wait for language
      }else{
        this.openingCheck = '';
        return false;
      }
    }

    // Detect ``` - this can appear at any position in the chunk
    if (chunk.includes('```') && this.openingCheck === '') {
      // Extract text before ``` for preservation
      const tripleBacktickIndex = chunk.indexOf('```');
      const textBeforeCodeBlock = chunk.substring(0, tripleBacktickIndex);
      const textAfterTripleBacktick = chunk.substring(tripleBacktickIndex + 3);
      
      // Store text that should be preserved before code block starts
      if (textBeforeCodeBlock && bufferState) {
        bufferState.textBeforeCodeBlock = textBeforeCodeBlock;
      }
      
      // Start language detection phase with remaining content
      this.languageCheck = textAfterTripleBacktick;
      this.detectedLanguage = '';
      this.languageDetectionMode = true;
      return null; // Don't start buffering yet, wait for language
    }

    // Handle language detection phase (after ``` was detected)
    if (this.languageDetectionMode && this.detectedLanguage === '') {
      // We're in language detection mode - accumulate chunks until we get LANG\n
      this.languageCheck += chunk;
      
      if(this.checkLangInDetectionMode(this.languageCheck, bufferState)){
        this.openingCheck = '';
        return true;
      }
      
      // Still waiting for complete LANG\n pattern
      return null;
    }

    return false;
  }

  private checkLang(checking: string, bufferState?: BufferState): boolean
  {
    const languageMatch = checking.match(/(.*)```([a-zA-Z]+)\n(.*)$/);
    if (languageMatch) {
      if(bufferState && languageMatch[1]){
        bufferState.textBeforeCodeBlock = languageMatch[1]
      }            

      this.detectedLanguage = this.normalizeLanguage(languageMatch[2]);
      this.languageDetectionMode = false;

      // Store content after language+newline as first chunk for the component
      if (bufferState && languageMatch[3]) {
        bufferState.contentAfterLanguage = languageMatch[3];
      }

      return true; // Start buffering now
    }

    return false;
  }

  private checkLangInDetectionMode(checking: string, bufferState?: BufferState): boolean
  {
      const languageMatch = checking.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\n/);
      if (languageMatch) {
        // Found complete language + newline, now we can start buffering
        this.detectedLanguage = this.normalizeLanguage(languageMatch[1]);
        this.languageDetectionMode = false; // Stop language detection
        
        // Store any content that comes after the language+newline in bufferState
        const contentAfterLanguage = this.languageCheck.replace(/^[a-zA-Z][a-zA-Z0-9_-]*\n/, '');
        if (contentAfterLanguage && bufferState) {
          bufferState.contentAfterLanguage = contentAfterLanguage;
        }

        
        return true; // Start buffering now
      }

      return false;
  }

  tryCompleteMatch(chunk: string, bufferState?: BufferState): CompleteMatchResult | null {
    if (this.shouldSkipProcessing(bufferState, chunk)) {
      return null;
    }
                console.log('REPL')

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
        
        // Track this code-viewer to prevent duplicates
        CodeBlockRule.createdCodeViewers.add(codeId);
        setTimeout(() => CodeBlockRule.createdCodeViewers.delete(codeId), 30000);
        

        const replacement = `<code-viewer componentId="${codeId}" language="${language}" streaming="false">${content}</code-viewer>`;

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
    if (this.shouldSkipProcessing(bufferState, chunk)) {
      return {
        processedChunk: chunk,
        finisher: '',
        closure: ''
      };
    }

    // Generate unique ID for the code-viewer
    const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
    
    // Store the componentId in buffer state for later use
    if (bufferState) {
      bufferState.currentCodeViewerId = codeId;
      bufferState.isFirstBufferingChunk = true; // Mark that the next chunk will be the first buffering chunk
    }
    
    // Use the detected language from detect() method, or default to plaintext
    let language = this.detectedLanguage || 'plaintext';
    
    // Prepare the text to output before code-viewer tag
    let textBeforeTag = '';
    if (bufferState?.textBeforeCodeBlock) {
      textBeforeTag = bufferState.textBeforeCodeBlock;
      // Clear it after using
      delete bufferState.textBeforeCodeBlock;
    }
    
    // Create the code-viewer tag immediately with the detected language
    const openTag = `<code-viewer componentId="${codeId}" language="${language}" streaming="true"></code-viewer>`;
    const closeTag = '</code-viewer>';
    
    // Track this code-viewer to prevent duplicates
    CodeBlockRule.createdCodeViewers.add(codeId);
    setTimeout(() => CodeBlockRule.createdCodeViewers.delete(codeId), 30000);
    
    // Reset detection state for next code block
    this.openingCheck = '';
    this.languageCheck = '';
    this.detectedLanguage = '';
    this.languageDetectionMode = false;
    
    // Skip the language part in the chunk and start buffering from the content
    let processedChunk = textBeforeTag + openTag;
    
    // Note: Content that came after language+newline is stored in bufferState.contentAfterLanguage
    // and will be handled in the first call to continueBuffering
    
    return {
      processedChunk: processedChunk,
      finisher: undefined, // Use detectFinish() method instead
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
   * Detect if code block should finish (when finisher is undefined)
   */
  override detectFinish(chunk: string, _currentBuffer: string, bufferState?: BufferState): boolean {
    // Handle partial ``` sequences from previous chunks
    const partialClosing = bufferState?.partialClosing || '';
    const combinedChunk = partialClosing + chunk;    
    

    // Check if combined chunk contains complete finisher ```
    const stopIt =  combinedChunk.includes('```');

    if(stopIt && bufferState){
      // Set the finisher so handleBufferingCompletion can process it properly
      bufferState.bufferingFinisher = '```';
      bufferState.buffering = false;
    }

    return stopIt;
  }

  /**
   * Handle continuation of buffering for code block special cases
   */
  override continueBuffering(chunk: string, _currentBuffer: string, _finisher: string, closure: string, _bufferState?: any): BufferingResult | null {
    // For normal code-viewer buffering (after opening tag was created)
    if (closure === '</code-viewer>') {
      let processedChunk = chunk;
      
      // Check if this is the very first chunk after starting buffering
      if (_bufferState?.isFirstBufferingChunk) {
        // This is the first chunk - check if we have initial content from language detection
        const initialContent = _bufferState.contentAfterLanguage || '';
        delete _bufferState.contentAfterLanguage; // Clear it
        _bufferState.isFirstBufferingChunk = false; // Mark that we've processed the first chunk
        
        // Combine initial content with current chunk
        processedChunk = initialContent + chunk;
      }
      
      // Handle partial ``` sequences from previous chunks
      const partialClosing = _bufferState?.partialClosing || '';
      const combinedChunk = partialClosing + processedChunk;
      
      // Check if combined chunk contains complete finisher ```
      if (combinedChunk.includes('```')) {
        return null; // Let main completion logic handle it
      }
      
      // Check if current processed chunk ends with partial ` or `` for next chunk
      let newPartialClosing = '';
      if (processedChunk.endsWith('``')) {
        newPartialClosing = '``';
      } else if (processedChunk.endsWith('`')) {
        newPartialClosing = '`';
      }
      
      // Update buffer state with new partial sequence
      if (_bufferState && newPartialClosing !== '') {
        _bufferState.partialClosing = newPartialClosing;
        
        // Extract the content before the partial sequence and process it
        const contentBeforePartial = processedChunk.substring(0, processedChunk.length - newPartialClosing.length);
        if (contentBeforePartial) {
          return {
            processedChunk: this.extractPlainText(contentBeforePartial),
            finisher: undefined,
            closure: '</code-viewer>'
          };
        }
        
        return null; // Only return null if there's no content to process
      }
      
      // Normal chunk processing - use the processed chunk (which may include initial content)
      return {
        processedChunk: this.extractPlainText(processedChunk),
        finisher: undefined,
        closure: '</code-viewer>'
      };
    }
    
    return null; // Not handled by this rule, let parent handle
  }

  /**
   * Handle special completion logic for code blocks with partial ``` detection
   */
  override handleBufferingCompletion(chunk: string, currentBuffer: string, finisher: string, closure: string, bufferState?: any): { finalChunk: string; remainingChunk: string; shouldContinue: boolean } | null {
    
    // Only handle code-viewer completion
    if (closure !== '</code-viewer>' || finisher !== '```') {
      return null;
    }

    // Handle partial ``` sequences
    let partialClosing = bufferState?.partialClosing || '';
    let processedChunk = partialClosing + chunk;
    
    // Check if the processed chunk creates a complete ``` anywhere
    if (processedChunk.includes('```')) {
      
      // Found complete ``` - END THE CODE BLOCK immediately
      const finisherIndex = processedChunk.indexOf('```');
      const beforeFinisher = processedChunk.substring(0, finisherIndex);
      const afterFinisher = processedChunk.substring(finisherIndex + 3);
      
      // Clear partial closing and currentCodeViewerId BEFORE returning
      if (bufferState) {
        bufferState.partialClosing = undefined;
        bufferState.currentCodeViewerId = null;
        bufferState.buffering = false;
        bufferState.currentRule = undefined;
      }

      const finalChunk = beforeFinisher ? this.extractPlainText(beforeFinisher) : '';

      return {
        finalChunk,
        remainingChunk: afterFinisher,
        shouldContinue: false
      };
    } else {
      // No complete ``` found yet, check if we have a new partial sequence
      const fullCurrentContent = currentBuffer + processedChunk;
      
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
        
        // Return content if any
        return {
          finalChunk: contentToAdd ? this.extractPlainText(contentToAdd) : '',
          remainingChunk: '',
          shouldContinue: true
        };
      } else {
        // No partial sequence detected, process content normally
        // Clear any previous partial closing since it's not completing and should be included as content
        if (bufferState) {
          bufferState.partialClosing = undefined;
        }
        
        // Return processed content
        return {
          finalChunk: processedChunk ? this.extractPlainText(processedChunk) : '',
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
        console.log(content);
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
