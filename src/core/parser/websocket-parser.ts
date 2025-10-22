import { ReactiveControllerHost } from 'lit';
import { ChatResponseError } from '../../utils/index.js';
import { parseCitations, updateCitationsEntry, updateTextEntry } from './index.js';
import { createBufferState, processChunkWithBuffering } from './bufferer.js';

export async function parseStreamedMessagesFromWebSocket({
  chatEntry,
  chunk,
  onChunkRead: onVisit,
}: {
  chatEntry: ChatThreadEntry;
  chunk: any;
  onChunkRead: (updated: ChatThreadEntry) => void;
  onCancel: () => void;  
}, host: ReactiveControllerHost) {

  const streamedMessageRaw: string[] = [];
  let rawContentAccumulator = chatEntry.rawContent || ''; // Continue from existing raw content
  const bufferState = createBufferState();
  let textBlockIndex = 0;

  let updatedEntry = {
    ...chatEntry,
  };

  // Handle error chunks
  if ('error' in chunk) {
    throw new ChatResponseError(chunk.message, chunk.statusCode || 500);
  }

  // Handle conversation ID
  if (chunk.conversationId) {
    const event = new CustomEvent('chat:conversation:start', {
      detail: { conversationId: chunk.conversationId },
      bubbles: true,
      composed: true
    });
    (host as any).dispatchEvent(event);
    
    return;
  }    

  // Handle content filtering
  if (chunk.finish_reason === 'content_filter') {
    throw new ChatResponseError('Content filtered', 400);
  }

  // Handle context data (thoughts, data points)
  if (chunk.context?.data_points) {
    updatedEntry.dataPoints = chunk.context.data_points ?? [];
    updatedEntry.thoughts = chunk.context.thoughts ?? '';
    onVisit(updatedEntry);
    return;
  }

  // Handle rws_progress status for progress updates
  if (chunk.status === 'rws_progress') {
    const { progress } = chunk;
    if (progress) {
      // Dispatch progress event to chat component
      const event = new CustomEvent('chat:progress', {
        detail: {
          stage: progress.stage || '',
          message: progress.message || '',
          percentage: progress.details?.percentage || 0,
          details: progress.details
        },
        bubbles: true,
        composed: true
      });
      (host as any).dispatchEvent(event);
    }
    return;
  }

  let chunkValue = chunk.content ?? chunk.delta?.content ?? '';

  if (chunkValue === '') {
    return;
  }

  // Accumulate raw content before applying parsing rules
  rawContentAccumulator += chunkValue;

  streamedMessageRaw.push(chunkValue);      

  // Process chunk with buffering
  const { processedChunk, bufferState: updatedBufferState } = processChunkWithBuffering(chunkValue, bufferState);
  
  // Update buffer state
  Object.assign(bufferState, updatedBufferState);
  
  if (processedChunk !== null) {
    updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
  }
  
  const citations = parseCitations(streamedMessageRaw.join(''));
  updatedEntry = updateCitationsEntry({ citations, chatEntry: updatedEntry });
  
  // Set the accumulated raw content
  updatedEntry.rawContent = rawContentAccumulator;

  onVisit(updatedEntry);
}
