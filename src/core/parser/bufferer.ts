import { BufferingRuleManager } from './buffering-rules';

export interface BufferState {
  buffering: boolean;
  bufferingFinisher: string | null;
  bufferingClosure: string | null;
  bufferText: string;
  skipOne: boolean;
  insideCodeViewer: boolean;
  codeViewerDepth: number;
  insideListViewer: boolean;
  listViewerDepth: number;
  linebreakProof: boolean;
}

export interface ParseOptions {
  mode: 'full' | 'chunk' | 'chunked-full';
  chunkSize?: number;
  duringBuffering?: (bufferState: BufferState, chunk: string) => void;
}

export function createBufferState(): BufferState {
  return {
    buffering: false,
    bufferingFinisher: null,
    bufferingClosure: null,
    bufferText: '',
    skipOne: false,
    insideCodeViewer: false,
    codeViewerDepth: 0,
    insideListViewer: false,
    listViewerDepth: 0,
    linebreakProof: false,
  };
}

/**
 * Parse full message text with all markdown elements
 * This function processes complete text and applies all markdown transformations
 */
export function parseFullMessage(text: string): string {
  if (!text) return text;
  
  // Use the buffering rule manager to process full text
  const ruleManager = new BufferingRuleManager();
  return ruleManager.processFullText(text);
}

/**
 * Process full message text by simulating chunk-based processing
 * This allows you to use the existing chunk-based logic with complete text
 */
export function processFullMessageAsChunks(
  text: string,
  chunkSize: number = 10,
  duringBuffering: (bufferState: BufferState, chunk: string) => void = () => {}
): string {
  if (!text) return text;
  
  const bufferState = createBufferState();
  let result = '';
  
  // Split text into chunks
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, i + chunkSize);
    const { processedChunk } = processChunkWithBuffering(chunk, bufferState, duringBuffering);
    
    if (processedChunk !== null) {
      result += processedChunk;
    }
  }
  
  // Handle any remaining buffered content
  if (bufferState.buffering && bufferState.bufferText) {
    if (bufferState.bufferingClosure) {
      result += bufferState.bufferText + bufferState.bufferingClosure;
    } else {
      result += bufferState.bufferText;
    }
  }

  return result;
}

/**
 * Unified parsing function that handles both full text and chunk-based processing
 * @param text - The text to parse
 * @param options - Parsing options
 * @returns Processed text
 */
export function parseText(text: string, options: ParseOptions = { mode: 'full' }): string {
  switch (options.mode) {
    case 'full':
      return parseFullMessage(text);
    
    case 'chunked-full':
      return processFullMessageAsChunks(
        text, 
        options.chunkSize || 10, 
        options.duringBuffering || (() => {})
      );
    
    case 'chunk':
    default:
      // For single chunk processing, you'd need to maintain state externally
      throw new Error('Chunk mode requires external buffer state management. Use processChunkWithBuffering directly.');
  }
}

export function processChunkWithBuffering(
  chunkValue: string,
  bufferState: BufferState,
  duringBuffering: (bufferState: BufferState, chunk: string) => void = () => {}
): { processedChunk: string | null; bufferState: BufferState } {
  let processedChunk = chunkValue;
  
  // Initialize rule manager (could be cached/reused)
  const ruleManager = new BufferingRuleManager();

  // Try to apply buffering rules if not already buffering
  if (!bufferState.buffering) {
    const ruleResult = ruleManager.processChunk(processedChunk, bufferState);
    
    if (ruleResult) {
      if (ruleResult.processedChunk !== null) {
        // Rule completed immediately, return the result
        return { processedChunk: ruleResult.processedChunk, bufferState: ruleResult.bufferState };
      } else {
        // Rule started buffering, update the processed chunk
        const rule = ruleManager.getRule(ruleResult.ruleApplied!);
        if (rule) {
          const bufferingResult = rule.startBuffering(processedChunk);
          processedChunk = bufferingResult.processedChunk;
        }
      }
    }
  }

  // If not buffering, return the processed chunk immediately
  if (!bufferState.buffering) {
    return { processedChunk, bufferState };
  }

  // Handle buffering completion
  if (bufferState.bufferingFinisher && 
      bufferState.bufferingClosure && 
      processedChunk.includes(bufferState.bufferingFinisher) && 
      !bufferState.skipOne) {

    let finalChunk: string;
    
    // Special handling for code block language detection
    if (bufferState.bufferingClosure === '__TEMP_CODE_BLOCK_WAITING__') {
      // We were waiting for a language after ```
      // Accumulate content until we find a newline
      const combinedContent = bufferState.bufferText + processedChunk;
      const finisherIndex = combinedContent.indexOf(bufferState.bufferingFinisher);
      
      if (finisherIndex >= 0) {
        const languageCandidate = combinedContent.substring(0, finisherIndex);
        const textAfterFinisher = combinedContent.substring(finisherIndex + 1); // Skip the newline
        
        // Check if we have a valid language
        const languageMatch = languageCandidate.match(/^(\w+)$/);
        if (languageMatch) {
          const language = languageMatch[1];
          const ruleManager = new BufferingRuleManager();
          const codeBlockRule = ruleManager.getRule('code-block') as any;
          const normalizedLanguage = codeBlockRule ? codeBlockRule.normalizeLanguage(language) : language;
          
          // Generate a unique ID for the code-viewer using voucher
          const voucher = require('voucher-code-generator');
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          
          // NOW create the code-viewer tag and start proper buffering
          const openTag = `<code-viewer componentId="${codeId}" language="${normalizedLanguage}">`;
          bufferState.bufferingFinisher = '```';
          bufferState.bufferingClosure = '</code-viewer>';
          bufferState.insideCodeViewer = true;
          bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
          
          // Return the opening tag and start buffering the code content
          finalChunk = openTag + textAfterFinisher;
          bufferState.bufferText = ''; // Reset buffer since we're outputting the tag now
          
          // Reset buffering state since we're outputting content
          bufferState.buffering = false;
          bufferState.skipOne = false;
          bufferState.linebreakProof = true; // Code blocks are linebreak proof
          
          return { processedChunk: finalChunk, bufferState };
        } else {
          // Not a valid language, treat as plaintext
          const voucher = require('voucher-code-generator');
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          
          const openTag = `<code-viewer componentId="${codeId}" language="plaintext">`;
          bufferState.bufferingFinisher = '```';
          bufferState.bufferingClosure = '</code-viewer>';
          bufferState.insideCodeViewer = true;
          bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
          
          // Treat the languageCandidate as code content
          finalChunk = openTag + languageCandidate + textAfterFinisher;
          bufferState.bufferText = '';
          bufferState.buffering = false;
          bufferState.skipOne = false;
          bufferState.linebreakProof = true;
          
          return { processedChunk: finalChunk, bufferState };
        }
      } else {
        // No newline found yet, continue waiting and accumulate content
        bufferState.bufferText += processedChunk;
        return { processedChunk: null, bufferState };
      }
    } else if (bufferState.bufferingClosure && bufferState.bufferingClosure.startsWith('__TEMP_CODE_BLOCK_LANG_WAITING__')) {
      // Handle partial language accumulation
      const partialLanguageMatch = bufferState.bufferingClosure.match(/__TEMP_CODE_BLOCK_LANG_WAITING__([a-zA-Z]+)__/);
      const partialLanguage = partialLanguageMatch ? partialLanguageMatch[1] : '';
      
      const combinedLanguage = partialLanguage + bufferState.bufferText + processedChunk;
      const finisherIndex = combinedLanguage.indexOf(bufferState.bufferingFinisher);
      
      if (finisherIndex >= 0) {
        const completeLanguage = combinedLanguage.substring(0, finisherIndex);
        const textAfterFinisher = combinedLanguage.substring(finisherIndex + 1);
        
        if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(completeLanguage) && completeLanguage.length <= 20) {
          const codeBlockRule = ruleManager.getRule('code-block') as any;
          const normalizedLanguage = codeBlockRule ? codeBlockRule.normalizeLanguage(completeLanguage) : completeLanguage;
          
          const voucher = require('voucher-code-generator');
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          
          // Create the code-viewer tag and output it immediately
          const openTag = `<code-viewer componentId="${codeId}" language="${normalizedLanguage}">`;
          finalChunk = openTag + textAfterFinisher;
          
          bufferState.bufferingFinisher = '```';
          bufferState.bufferingClosure = '</code-viewer>';
          bufferState.insideCodeViewer = true;
          bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
          bufferState.bufferText = '';
          bufferState.buffering = false;
          bufferState.skipOne = false;
          bufferState.linebreakProof = true;
          
          return { processedChunk: finalChunk, bufferState };
        } else {
          // Invalid language, treat as plaintext
          const voucher = require('voucher-code-generator');
          const codeId = voucher.generate({ count: 1, length: 8 })[0].toLowerCase();
          
          const openTag = `<code-viewer componentId="${codeId}" language="plaintext">`;
          finalChunk = openTag + combinedLanguage;
          
          bufferState.bufferingFinisher = '```';
          bufferState.bufferingClosure = '</code-viewer>';
          bufferState.insideCodeViewer = true;
          bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
          bufferState.bufferText = '';
          bufferState.buffering = false;
          bufferState.skipOne = false;
          bufferState.linebreakProof = true;
          
          return { processedChunk: finalChunk, bufferState };
        }
      } else {
        // Still waiting for newline, continue accumulating
        bufferState.bufferText += processedChunk;
        return { processedChunk: null, bufferState };
      }
    } else if (bufferState.bufferingFinisher === '\n') {
      // Handle header completion with single newline
      const finisherIndex = processedChunk.indexOf(bufferState.bufferingFinisher);
      const contentBeforeFinisher = processedChunk.substring(0, finisherIndex);
      const textAfterFinisher = processedChunk.substring(finisherIndex);
      
      finalChunk = bufferState.bufferText + contentBeforeFinisher + bufferState.bufferingClosure + textAfterFinisher;
    } else {
      // Handle other buffering types (including code blocks)
      const finisherIndex = processedChunk.indexOf(bufferState.bufferingFinisher);
      const contentBeforeFinisher = processedChunk.substring(0, finisherIndex);
      const textAfterFinisher = processedChunk.substring(finisherIndex + bufferState.bufferingFinisher.length);
      
      finalChunk = bufferState.bufferText + contentBeforeFinisher + bufferState.bufferingClosure + textAfterFinisher;
    }

    // Reset buffer state
    const wasCodeViewer = bufferState.bufferingClosure === '</code-viewer>';
    bufferState.bufferingFinisher = null;
    bufferState.bufferingClosure = null;
    bufferState.bufferText = '';
    bufferState.buffering = false;
    bufferState.skipOne = false;
    bufferState.linebreakProof = false;
    if (wasCodeViewer) {
      bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
      bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
      // Keep linebreakProof true if still inside code viewer
      if (bufferState.insideCodeViewer) {
        bufferState.linebreakProof = true;
      }
    }

    return { processedChunk: finalChunk, bufferState };
  } else {
    // Continue buffering
    // For code-viewer buffering, ensure we only pass plain text content
    let textToBuffer = processedChunk;
    if (bufferState.bufferingClosure === '</code-viewer>') {
      // Extract plain text content for code-viewer
      textToBuffer = extractPlainTextForCodeViewer(processedChunk);
    }
    
    bufferState.bufferText += textToBuffer;
    
    if(!bufferState.skipOne){
      // For code-viewer updates, pass the plain text chunk to updateRenderer
      duringBuffering(bufferState, bufferState.bufferingClosure === '</code-viewer>' ? textToBuffer : processedChunk);
    }
    bufferState.skipOne = false;
    return { processedChunk: null, bufferState };
  }
}

/**
 * Extract plain text content for code-viewer components
 * This ensures only text content is passed, no HTML tags
 */
function extractPlainTextForCodeViewer(content: string): string {
  if (!content) return content;
  
  // For code blocks, we want to preserve all text as-is for proper display
  // The code-viewer component will handle proper escaping and highlighting
  return content;
}

// Usage examples:
// 
// 1. Parse full message at once (fastest, most reliable):
// const result = parseFullMessage("# Header\n\nSome **bold** text with ```code```");
//
// 2. Parse full message using chunk-based processing:
// const result = processFullMessageAsChunks("# Header\n\nSome **bold** text", 5);
//
// 3. Use unified API:
// const result = parseText("# Header\n\nSome **bold** text", { mode: 'full' });
// const result2 = parseText("# Header\n\nSome **bold** text", { mode: 'chunked-full', chunkSize: 10 });
//
// 4. Continue using chunk-based processing for streaming:
// const bufferState = createBufferState();
// const { processedChunk } = processChunkWithBuffering(chunk, bufferState);
