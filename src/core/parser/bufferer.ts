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
  ruleManager?: BufferingRuleManager; // Rule manager instance - created once per message stream
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
      // Check for finisher including partial sequences
      const partialClosing = bufferState.partialClosing || '';
      const combinedChunk = partialClosing + processedChunk;
      shouldFinish = combinedChunk.includes(bufferState.bufferingFinisher);
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
      
      // Try rule-specific completion logic first
      const completionResult = ruleManager.handleCompletion(
        processedChunk,
        bufferState,
        bufferState.currentRule
      );

      if (completionResult) {
        // Rule handled completion
        let finalChunk = completionResult.finalChunk;
        
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
              linebreakProof: bufferState.insideCodeViewer && bufferState.codeViewerDepth > 1,
              ruleManager: bufferState.ruleManager // Preserve rule manager instance
            },
            duringBuffering
          );
          
          if (remainingResult.processedChunk) {
            finalChunk += remainingResult.processedChunk;
          }
          
          Object.assign(bufferState, remainingResult.bufferState);
        }

        // Always reset buffer state after completion
        const wasCodeViewer = bufferState.bufferingClosure === '</code-viewer>';
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false;
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;
        
        if (wasCodeViewer) {
          bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
          bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
          if (bufferState.insideCodeViewer) {
            bufferState.linebreakProof = true;
          }
        }

              console.log({finalChunk})


        return { processedChunk: finalChunk, bufferState };
      }

      // Fallback to generic completion logic (only if we have a finisher)
      if (bufferState.bufferingFinisher) {
        const finisherIndex = processedChunk.indexOf(bufferState.bufferingFinisher);
        const contentBeforeFinisher = processedChunk.substring(0, finisherIndex);
        const textAfterFinisher = processedChunk.substring(finisherIndex + bufferState.bufferingFinisher.length);
        
        const finalChunk = bufferState.bufferText + contentBeforeFinisher + bufferState.bufferingClosure + textAfterFinisher;

        // Call stopCodeGeneration if this was a code-viewer completion
        const wasCodeViewer = bufferState.bufferingClosure === '</code-viewer>';
        if (wasCodeViewer) {
          // Extract componentId from bufferText to find the component
          const componentIdMatch = bufferState.bufferText.match(/componentId="([^"]+)"/);
          if (componentIdMatch) {
            const componentId = componentIdMatch[1];
            
            const codeViewer = document.querySelector(`code-viewer[componentId="${componentId}"]`) as any;
            if (codeViewer && typeof codeViewer.stopCodeGeneration === 'function') {
              codeViewer.stopCodeGeneration();
            }
          }
        }

        // Reset buffer state
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false;
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;
        
        if (wasCodeViewer) {
          bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
          bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
          if (bufferState.insideCodeViewer) {
            bufferState.linebreakProof = true;
          }
        }

        return { processedChunk: finalChunk, bufferState };
      } else {
        // No finisher set and detectFinish() returned true - complete with just the closure
        const finalChunk = bufferState.bufferText + bufferState.bufferingClosure + processedChunk;

        // Call stopCodeGeneration if this was a code-viewer completion
        const wasCodeViewer = bufferState.bufferingClosure === '</code-viewer>';
        if (wasCodeViewer) {
          // Extract componentId from bufferText to find the component
          const componentIdMatch = bufferState.bufferText.match(/componentId="([^"]+)"/);
          if (componentIdMatch) {
            const componentId = componentIdMatch[1];
            
            const codeViewer = document.querySelector(`code-viewer[componentId="${componentId}"]`) as any;
            if (codeViewer && typeof codeViewer.stopCodeGeneration === 'function') {
              codeViewer.stopCodeGeneration();
            }
          }
        }

        // Reset buffer state
        bufferState.bufferingFinisher = null;
        bufferState.bufferingClosure = null;
        bufferState.bufferText = '';
        bufferState.buffering = false;
        bufferState.skipOne = false;
        bufferState.linebreakProof = false;
        bufferState.partialClosing = undefined;
        bufferState.currentRule = undefined;
        bufferState.currentCodeViewerId = undefined;
        bufferState.waitingForLanguage = undefined;
        
        if (wasCodeViewer) {
          bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
          bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
          if (bufferState.insideCodeViewer) {
            bufferState.linebreakProof = true;
          }
        }

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
