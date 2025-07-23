export interface BufferState {
  buffering: boolean;
  bufferingFinisher: string | null;
  bufferingClosure: string | null;
  bufferText: string;
  skipOne: boolean;
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

export function processChunkWithBuffering(
  chunkValue: string,
  bufferState: BufferState,
  duringBuffering: (bufferState: BufferState, chunk: string) => void = () => {}
): { processedChunk: string | null; bufferState: BufferState } {
  let processedChunk = chunkValue;

  // Handle line breaks when not buffering
  if (!bufferState.buffering && processedChunk.includes('\n\n')) {
    processedChunk = processedChunk.replace(/\n\n/g, '<br/>');
  }

  // Start buffering for bold text
  if (!bufferState.buffering && processedChunk.includes('**')) {      
    bufferState.buffering = true;
    processedChunk = processedChunk.replace('**', '<strong>');
    bufferState.bufferingFinisher = '**';
    bufferState.bufferingClosure = '</strong>';
  }

  // Start buffering for h1 headers
  if (!bufferState.buffering && processedChunk.startsWith('#') && !processedChunk.startsWith('##')) {      
    bufferState.buffering = true;
    processedChunk = processedChunk.replace('#', '<h1>');
    bufferState.bufferingFinisher = '\n';
    bufferState.bufferingClosure = '</h1>';
  }

  // Start buffering for h2 headers
  if (!bufferState.buffering && processedChunk.startsWith('##') && !processedChunk.startsWith('###')) {      
    bufferState.buffering = true;
    processedChunk = processedChunk.replace('##', '<h2>');
    bufferState.bufferingFinisher = '\n';
    bufferState.bufferingClosure = '</h2>';
  }

  // Start buffering for h3 headers
  if (!bufferState.buffering && processedChunk.startsWith('###')) {      
    bufferState.buffering = true;
    processedChunk = processedChunk.replace('###', '<h3>');
    bufferState.bufferingFinisher = '\n';
    bufferState.bufferingClosure = '</h3>';
  }

  // Start buffering for code blocks
  if (!bufferState.buffering && processedChunk.startsWith('```')) {
    bufferState.buffering = true;
    bufferState.bufferingFinisher = '```';
    bufferState.bufferingClosure = '```';
    bufferState.skipOne = true;
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
