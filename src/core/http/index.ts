import { ChatResponseError } from '../../utils/index.js';

export async function callHttpApi(
  { question, type, approach, overrides, messages, files }: ChatRequestOptions,
  { method, url, stream, signal, headers = {} }: ChatHttpOptions,
) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const mergedHeaders = {
    ...defaultHeaders,
    ...headers,
  };

  // Use messages as-is if provided, otherwise create a user message from question/files (legacy support)
  let requestMessages = messages ?? [];
  
  // Only create a user message if we have question/files but no messages (legacy support)
  if ((question || files) && (!messages || messages.length === 0)) {
    const userMessage: any = {
      role: 'user',
    };

    // Build content array for multimodal format
    const contentArray: any[] = [];
    
    // Add text content if it exists
    if (question && question.trim()) {
      contentArray.push({
        type: 'text',
        text: question
      });
    }

    // Add files as image entries if they exist
    if (files && files.length > 0) {
      files.forEach(file => {
        contentArray.push({
          type: 'image',
          image: `data:${file.mimeType};base64,${file.base64}`
        });
      });
    }

    // Set content based on whether we have multimodal content
    if (contentArray.length > 1 || (contentArray.length === 1 && contentArray[0].type !== 'text')) {
      // Use array format for multimodal content
      userMessage.content = contentArray;
    } else if (contentArray.length === 1 && contentArray[0].type === 'text') {
      // Use simple string format for text-only content
      userMessage.content = contentArray[0].text;
    } else {
      // Fallback to empty string
      userMessage.content = '';
    }
    
    requestMessages = [userMessage];
  }

  console.log({mergedHeaders});

  return await fetch(`${url}/${type}`, {
    method: method,
    headers: mergedHeaders,
    signal,
    body: JSON.stringify({
      messages: requestMessages,
      context: {
        ...overrides,
        approach,
      },
      stream: type === 'chat' ? stream : false,
    }),
  });
}

export async function getAPIResponse(
  requestOptions: ChatRequestOptions,
  httpOptions: ChatHttpOptions,
): Promise<BotResponse | Response> {
  const response = await callHttpApi(requestOptions, httpOptions);

  // TODO: we should just use the value from httpOptions.stream
  const streamResponse = requestOptions.type === 'ask' ? false : httpOptions.stream;
  if (streamResponse) {
    return response;
  }
  const parsedResponse: BotResponse = await response.json();
  if (response.status > 299 || !response.ok) {
    throw new ChatResponseError(response.statusText, response.status) || 'API Response Error';
  }
  return parsedResponse;
}
