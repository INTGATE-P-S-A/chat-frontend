import { ReactiveControllerHost } from 'lit';
import { ChatResponseError } from '../../utils/index.js';
import { parseCitations, updateCitationsEntry, updateTextEntry } from './index.js';

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
  
  let buffering = false;
  let bufferingFinisher: string | null = null;
  let bufferingClosure: string | null = null;
  let bufferText: string = '';

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

  let chunkValue = chunk.content ?? chunk.delta?.content ?? '';

  if (chunkValue === '') {
    return;
  }

  streamedMessageRaw.push(chunkValue);      

  // Process markdown formatting similar to the original parser
  if (chunkValue.includes('\n\n')) {
    chunkValue = chunkValue.replace(/\n\n/g, '<br/>');
  }

  if (!buffering && chunkValue.includes('**')) {      
    buffering = true;
    chunkValue = chunkValue.replace('**', '<strong>');
    bufferingFinisher = '**';
    bufferingClosure = '</strong>';
  }

  if (!buffering && chunkValue.startsWith('#') && !chunkValue.startsWith('##')) {      
    buffering = true;
    chunkValue = chunkValue.replace('#', '<h1>');
    bufferingFinisher = '\n';
    bufferingClosure = '</h1>';
  }

  if (!buffering && chunkValue.startsWith('##') && !chunkValue.startsWith('###')) {      
    buffering = true;
    chunkValue = chunkValue.replace('##', '<h2>');
    bufferingFinisher = '\n';
    bufferingClosure = '</h2>';
  }

  if (!buffering && chunkValue.startsWith('###')) {      
    buffering = true;
    chunkValue = chunkValue.replace('###', '<h3>');
    bufferingFinisher = '\n';
    bufferingClosure = '</h3>';
  }
 
  if (!buffering) {
    updatedEntry = updateTextEntry({ chunkValue, textBlockIndex, chatEntry: updatedEntry });
  } else {
    if (bufferingFinisher && bufferingClosure && chunkValue.includes(bufferingFinisher)) {
      updatedEntry = updateTextEntry({ 
        chunkValue: bufferText + chunkValue.replace(bufferingFinisher, bufferingClosure), 
        textBlockIndex, 
        chatEntry: updatedEntry 
      });

      bufferingFinisher = null;
      bufferingClosure = null;
      bufferText = '';
      buffering = false;
    } else {
      bufferText += chunkValue;
    }      
  }
  
  const citations = parseCitations(streamedMessageRaw.join(''));
  updatedEntry = updateCitationsEntry({ citations, chatEntry: updatedEntry });

  onVisit(updatedEntry);
}
