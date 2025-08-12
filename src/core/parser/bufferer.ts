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
  partialClosing?: string; // For tracking partial closing sequences like ` or ``
  currentRule?: string; // Track which rule is currently buffering
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
  if (bufferState.currentRule && bufferState.bufferingFinisher && bufferState.bufferingClosure) {
    
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

    // If rule returned null, it wants main completion logic to handle finisher detection
    // Check for finisher including partial sequences
    const partialClosing = bufferState.partialClosing || '';
    const combinedChunk = partialClosing + processedChunk;
    
    if (combinedChunk.includes(bufferState.bufferingFinisher)) {
      
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
              linebreakProof: bufferState.insideCodeViewer && bufferState.codeViewerDepth > 1
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
        
        if (wasCodeViewer) {
          bufferState.codeViewerDepth = Math.max(0, (bufferState.codeViewerDepth || 1) - 1);
          bufferState.insideCodeViewer = bufferState.codeViewerDepth > 0;
          if (bufferState.insideCodeViewer) {
            bufferState.linebreakProof = true;
          }
        }

        return { processedChunk: finalChunk, bufferState };
      }

      // Fallback to generic completion logic
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
          
          setTimeout(() => {
            const codeViewer = document.querySelector(`code-viewer[componentId="${componentId}"]`) as any;
            if (codeViewer && typeof codeViewer.stopCodeGeneration === 'function') {
              codeViewer.stopCodeGeneration();
            }
          }, 0);
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
