import { BufferingRuleManager } from './buffering-rules';

export interface BufferState {
  buffering: boolean;
  bufferingFinisher: string | undefined | null;
  bufferingClosure: string | null;
  bufferText: string;
  skipOne: boolean;
  insideCodeViewer: boolean;
  codeViewerDepth: number;
  insideListViewer: boolean;
  listViewerDepth: number;
  linebreakProof: boolean;
  partialClosing?: string; // For tracking partial closing sequences like ` or ``
  currentRule?: string; // Track which rule is currently buffering
  currentCodeViewerId?: string; // Track the current code-viewer component ID for streaming
  waitingForLanguage?: boolean; // Track if we're waiting for language completion
  detectedLanguage?: string; // Store detected language when it comes in separate chunk from newline
  textBeforeCodeBlock?: string; // Store text that appears before ``` in code block detection
  contentAfterLanguage?: string; // Store content that comes after language+newline in same chunk
  isFirstBufferingChunk?: boolean; // Track if this is the first chunk after starting buffering
  ruleManager?: BufferingRuleManager; // Rule manager instance - created once per message stream
  
  // Rule processing control
  ruleProcessingMode?: 'sequential' | 'buffering-exclusive'; // Control how rules are processed
  exclusiveBufferingRule?: string; // Which rule has exclusive access during buffering
  allowedRulesWhileBuffering?: string[]; // Rules that can still process during exclusive buffering
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
    partialClosing: undefined,
    currentRule: undefined,
    ruleManager: new BufferingRuleManager(), // Create once per message stream
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
  
  // Use the rule manager from buffer state (created once per message stream)
  const ruleManager = bufferState.ruleManager!;

  // Try to apply buffering rules if not already buffering
  if (!bufferState.buffering) {
    const ruleResult = ruleManager.processChunk(processedChunk, bufferState);
    
    if (ruleResult) {
      bufferState.currentRule = ruleResult.ruleApplied;
      
      if (!bufferState.buffering) {
        // Rule completed immediately (not buffering), return the result
        return { processedChunk: ruleResult.processedChunk, bufferState: ruleResult.bufferState };
      } else {
        // Rule started buffering, processedChunk is the immediate output
        // Return the immediate output (like <code-viewer> tag) and continue buffering on next chunk
        return { processedChunk: ruleResult.processedChunk, bufferState: ruleResult.bufferState };
      }
    }
  }    

  // If not buffering, return the processed chunk immediately
  if (!bufferState.buffering) {
    return { processedChunk, bufferState };
  }

  // Handle buffering continuation with rule-specific logic
  if (bufferState.currentRule && bufferState.bufferingClosure) {
    
    // Check if we should finish buffering using detectFinish() when no finisher is set
    let shouldFinish = false;
    
    if (!bufferState.bufferingFinisher) {
      // No finisher set, use rule-specific detectFinish()
      shouldFinish = ruleManager.detectFinish(processedChunk, bufferState, bufferState.currentRule) === true;
    } else {
      // First try rule-specific detectFinish() for sophisticated detection
      const ruleDetection = ruleManager.detectFinish(processedChunk, bufferState, bufferState.currentRule);
      if (ruleDetection === true) {
        shouldFinish = true;
      } else {
        // Fallback to generic finisher detection only if rule doesn't have custom logic
        const partialClosing = bufferState.partialClosing || '';
        const combinedChunk = partialClosing + processedChunk;
        shouldFinish = combinedChunk.includes(bufferState.bufferingFinisher);
      }
    }

    if (!shouldFinish) {
      // First try rule-specific continuation logic
      const continuationResult = ruleManager.continueBuffering(
        processedChunk,
        bufferState,
        bufferState.currentRule
      );

      if (continuationResult) {
        if (!continuationResult.shouldContinue) {
          // Rule wants to complete buffering
          return { processedChunk: continuationResult.processedChunk, bufferState };
        }
        
        // Rule handled continuation, add to buffer if needed
        if (continuationResult.processedChunk) {
          bufferState.bufferText += continuationResult.processedChunk;
          duringBuffering(bufferState, continuationResult.processedChunk);
        }
        return { processedChunk: null, bufferState };
      }
    } else {
      // Should finish buffering - handle completion
      
      // IMPORTANT: Check currentRule BEFORE calling rule completion (rule may clear it)
      const wasCodeViewer = bufferState.currentRule === 'code-block';
      
      // Try rule-specific completion logic first
      const completionResult = ruleManager.handleCompletion(
        processedChunk,
        bufferState,
        bufferState.currentRule
      );

      if (completionResult) {
        // Send the final chunk to code-viewer BEFORE processing remaining content
        if (wasCodeViewer && completionResult.finalChunk) {
          duringBuffering(bufferState, completionResult.finalChunk);
        }
        
        // Rule handled completion
        let finalContent = '';
        let normalText = '';
        
        // For text formatting rules, we need to build the complete formatted output
        if (bufferState.currentRule === 'text-formatting') {
          // Build: buffer + content + closure + remaining
          finalContent = bufferState.bufferText + completionResult.finalChunk + bufferState.bufferingClosure;
          normalText = finalContent;
        } else {
          // For code-block rules, only send the actual code content (exclude text that appeared before the code block)
          // The bufferText should only contain the code content, not any introductory text
          finalContent = bufferState.bufferText + completionResult.finalChunk;
        }
        
        // Handle any remaining content after completion
        if (completionResult.remainingChunk) {
          const remainingResult = processChunkWithBuffering(
            completionResult.remainingChunk,
            {
              ...bufferState,
              buffering: false,
              bufferingClosure: null,
              bufferingFinisher: null,
              bufferText: '',
              skipOne: false,
              partialClosing: undefined,
              currentRule: undefined,
              currentCodeViewerId: undefined, // Explicitly clear this
              waitingForLanguage: undefined,
              linebreakProof: false, // CRITICAL: Ensure line breaks are allowed for remaining content
              insideCodeViewer: false, // Reset code viewer state for remaining content
              codeViewerDepth: 0, // Reset depth for remaining content
              ruleManager: bufferState.ruleManager // Preserve rule manager instance
            },
            undefined // NO duringBuffering callback - process as normal text
          );
          
          if (remainingResult.processedChunk) {
            // For text formatting, append remaining to the formatted output
            if (bufferState.currentRule === 'text-formatting') {
              normalText = normalText + remainingResult.processedChunk;
            } else {
              normalText = remainingResult.processedChunk;
            }
          }
          
          Object.assign(bufferState, remainingResult.bufferState);
        }

        // Send final content to code-viewer BEFORE clearing buffer state
        // Don't send final chunk here - it's handled in the parser via wasBufferingCodeViewer condition
        // This prevents duplication of the final chunk
        if (wasCodeViewer && completionResult.finalChunk) {
        }

        // Always reset buffer state after completion
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false; // CRITICAL: Always reset linebreakProof to allow line breaks after any rule completion
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;
        
        if (wasCodeViewer) {
          bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
          bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
          // Don't re-enable linebreakProof here - let line break rule process subsequent content
        }

        // Return the normal text for regular processing
        return { processedChunk: normalText, bufferState };
      }

      // Fallback to generic completion logic (only if we have a finisher)
      if (bufferState.bufferingFinisher) {
        const finisherIndex = processedChunk.indexOf(bufferState.bufferingFinisher);
        const contentBeforeFinisher = processedChunk.substring(0, finisherIndex);
        const textAfterFinisher = processedChunk.substring(finisherIndex + bufferState.bufferingFinisher.length);
        
        const finalChunk = bufferState.bufferText + contentBeforeFinisher + bufferState.bufferingClosure + textAfterFinisher;

        // Call stopCodeGeneration if this was a code-viewer completion

        // Reset buffer state
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false; // CRITICAL: Reset to allow line breaks after completion
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;


        return { processedChunk: finalChunk, bufferState };
      } else {
        // No finisher set and detectFinish() returned true - complete with just the closure
        const finalChunk = bufferState.bufferText + bufferState.bufferingClosure + processedChunk;

        // Reset buffer state
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false; // CRITICAL: Reset to allow line breaks after completion
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;
        

        return { processedChunk: finalChunk, bufferState };
      }
    }
  }

  // Continue buffering - process content through rule if available
  let textToBuffer = processedChunk;
  if (bufferState.currentRule) {
    textToBuffer = ruleManager.processContentForBuffer(processedChunk, bufferState.currentRule);
  }
  
  bufferState.bufferText += textToBuffer;
  
  if (!bufferState.skipOne) {
    duringBuffering(bufferState, textToBuffer);
  }
  bufferState.skipOne = false;
  return { processedChunk: null, bufferState };
}
