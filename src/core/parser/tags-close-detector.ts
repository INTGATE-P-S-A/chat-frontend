// HTML tag buffering state interface
export interface HtmlTagBufferState {
  htmlTagBuffer: string;
  isBufferingHtmlTag: boolean;
}

// Result interface for incomplete tag detection
export interface IncompleteTagResult {
  hasIncompleteTag: boolean;
  bufferContent: string;
  processableContent: string;
}

// Result interface for complete tag checking
export interface CompleteTagResult {
  isComplete: boolean;
  completeTag: string;
  remainingContent: string;
}

// Helper function to detect incomplete HTML tags
export function detectIncompleteHtmlTag(content: string): IncompleteTagResult {
  // Check if content ends with < (start of potential closing tag)
  if (content.endsWith('<')) {
    return {
      hasIncompleteTag: true,
      bufferContent: '<',
      processableContent: content.slice(0, -1)
    };
  }
  
  // Check if content ends with </ (definitely start of closing tag)
  if (content.endsWith('</')) {
    return {
      hasIncompleteTag: true,
      bufferContent: '</',
      processableContent: content.slice(0, -2)
    };
  }
  
  // Check for incomplete closing tag pattern: </tagname without >
  const incompleteClosingMatch = content.match(/<\/[^>]*$/);
  if (incompleteClosingMatch) {
    const incompleteTag = incompleteClosingMatch[0];
    return {
      hasIncompleteTag: true,
      bufferContent: incompleteTag,
      processableContent: content.slice(0, content.length - incompleteTag.length)
    };
  }
  
  return {
    hasIncompleteTag: false,
    bufferContent: '',
    processableContent: content
  };
}

// Helper function to check if buffered content forms a complete closing tag
export function isCompleteClosingTag(bufferedContent: string, newChunk: string): CompleteTagResult {
  const combined = bufferedContent + newChunk;
  
  // Look for complete closing tag pattern
  const closingTagMatch = combined.match(/^<\/[^>]*>/);
  if (closingTagMatch) {
    const completeTag = closingTagMatch[0];
    const remainingContent = combined.slice(completeTag.length);
    return {
      isComplete: true,
      completeTag,
      remainingContent
    };
  }
  
  // Check if we still have an incomplete tag
  const stillIncompleteMatch = combined.match(/^<\/[^>]*$/);
  if (stillIncompleteMatch) {
    return {
      isComplete: false,
      completeTag: '',
      remainingContent: ''
    };
  }
  
  // If it doesn't match expected pattern, treat as complete (fallback)
  return {
    isComplete: true,
    completeTag: combined,
    remainingContent: ''
  };
}

// Create initial HTML tag buffer state
export function createHtmlTagBufferState(): HtmlTagBufferState {
  return {
    htmlTagBuffer: '',
    isBufferingHtmlTag: false
  };
}

// Process a chunk with HTML tag buffering
export function processChunkWithHtmlTagBuffering(
  chunkValue: string,
  bufferState: HtmlTagBufferState
): { finalChunkValue: string; shouldSkip: boolean; bufferState: HtmlTagBufferState } {
  let finalChunkValue = chunkValue;
  let shouldSkip = false;

  if (bufferState.isBufferingHtmlTag) {
    // We're currently buffering an incomplete HTML tag
    const combined = bufferState.htmlTagBuffer + chunkValue;
    const { isComplete, completeTag, remainingContent } = isCompleteClosingTag(bufferState.htmlTagBuffer, chunkValue);
    
    if (isComplete) {
      // Tag is now complete, process the complete tag + remaining content
      finalChunkValue = completeTag + remainingContent;
      bufferState.isBufferingHtmlTag = false;
      bufferState.htmlTagBuffer = '';
      console.debug('HTML tag buffering completed:', completeTag);
    } else {
      // Still incomplete, update buffer and don't process anything yet
      bufferState.htmlTagBuffer = combined;
      console.debug('HTML tag buffering continues:', bufferState.htmlTagBuffer);
      shouldSkip = true; // Skip processing this chunk
    }
  } else {
    // Check if this chunk contains an incomplete HTML tag
    const { hasIncompleteTag, bufferContent, processableContent } = detectIncompleteHtmlTag(chunkValue);
    
    if (hasIncompleteTag) {
      // Start buffering the incomplete tag
      bufferState.isBufferingHtmlTag = true;
      bufferState.htmlTagBuffer = bufferContent;
      finalChunkValue = processableContent;
      console.debug('HTML tag buffering started:', bufferContent);
      
      // If there's no processable content, skip this iteration
      if (processableContent === '') {
        shouldSkip = true;
      }
    }
  }

  return {
    finalChunkValue,
    shouldSkip,
    bufferState
  };
}

// Handle any remaining buffered content when stream ends
export function handleRemainingHtmlTagBuffer(
  bufferState: HtmlTagBufferState
): { hasRemainingContent: boolean; remainingContent: string } {
  if (bufferState.isBufferingHtmlTag && bufferState.htmlTagBuffer) {
    console.debug('Processing remaining HTML tag buffer:', bufferState.htmlTagBuffer);
    const remainingContent = bufferState.htmlTagBuffer;
    
    // Clear the buffer
    bufferState.htmlTagBuffer = '';
    bufferState.isBufferingHtmlTag = false;
    
    return {
      hasRemainingContent: true,
      remainingContent
    };
  }
  
  return {
    hasRemainingContent: false,
    remainingContent: ''
  };
}
