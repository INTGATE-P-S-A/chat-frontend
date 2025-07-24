import { BufferingRuleManager } from './buffering-rules';

export interface BufferState {
  buffering: boolean;
  bufferingFinisher: string | null;
  bufferingClosure: string | null;
  bufferText: string;
  skipOne: boolean;
}

export interface MarkdownPattern {
  pattern: RegExp;
  openTag: string;
  closeTag: string;
  priority: number;
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
  };
}

// Define markdown patterns with priority (higher priority = processed first)
const MARKDOWN_PATTERNS: MarkdownPattern[] = [
  {
    pattern: /```[\s\S]*?```/g,
    openTag: '<code-viewer>',
    closeTag: '</code-viewer>',
    priority: 1
  },
  {
    pattern: /^### (.+)$/gm,
    openTag: '<h3>',
    closeTag: '</h3>',
    priority: 2
  },
  {
    pattern: /^## (.+)$/gm,
    openTag: '<h2>',
    closeTag: '</h2>',
    priority: 3
  },
  {
    pattern: /^# (.+)$/gm,
    openTag: '<h1>',
    closeTag: '</h1>',
    priority: 4
  },
  {
    pattern: /\*\*(.*?)\*\*/g,
    openTag: '<strong>',
    closeTag: '</strong>',
    priority: 5
  },
  {
    pattern: /\n\n/g,
    openTag: '<br/>',
    closeTag: '',
    priority: 6
  }
];

/**
 * Parse full message text with all markdown elements
 * This function processes complete text and applies all markdown transformations
 */
export function parseFullMessage(text: string): string {
  if (!text) return text;
  
  let processedText = text;
  
  // Sort patterns by priority (lower number = higher priority)
  const sortedPatterns = [...MARKDOWN_PATTERNS].sort((a, b) => a.priority - b.priority);
  
  for (const { pattern, openTag, closeTag } of sortedPatterns) {
    if (pattern.source.includes('```')) {
      // Special handling for code blocks
      processedText = processedText.replace(pattern, (match) => {
        const content = match.replace(/```/g, '');
        return `${openTag}${content}${closeTag}`;
      });
    } else if (pattern.source.includes('^#')) {
      // Special handling for headers (capture group)
      processedText = processedText.replace(pattern, (_, content) => {
        return `${openTag}${content}${closeTag}`;
      });
    } else if (pattern.source.includes('\\*\\*')) {
      // Special handling for bold text (capture group)
      processedText = processedText.replace(pattern, (_, content) => {
        return `${openTag}${content}${closeTag}`;
      });
    } else {
      // Simple replacement for line breaks
      processedText = processedText.replace(pattern, openTag);
    }
  }
  
  return processedText;
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

  // Handle line breaks when not buffering (do this AFTER header checks)
  if (!bufferState.buffering && processedChunk.includes('\n\n')) {
    processedChunk = processedChunk.replace(/\n\n/g, '<br/>');
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
    
    if (bufferState.bufferingFinisher === '```') {
      finalChunk = `<code-viewer>${bufferState.bufferText + processedChunk}</code-viewer>`;
    } else {
      finalChunk = bufferState.bufferText + processedChunk.replace(bufferState.bufferingFinisher, bufferState.bufferingClosure);
    }

    // Reset buffer state
    bufferState.bufferingFinisher = null;
    bufferState.bufferingClosure = null;
    bufferState.bufferText = '';
    bufferState.buffering = false;
    bufferState.skipOne = false;

    return { processedChunk: finalChunk, bufferState };
  } else {
    // Continue buffering
    bufferState.bufferText += processedChunk;
    
    if(!bufferState.skipOne){
      duringBuffering(bufferState, processedChunk);
    }
    bufferState.skipOne = false;
    return { processedChunk: null, bufferState };
  }
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
