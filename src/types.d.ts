declare interface ChatHttpOptions {
  method: string;
  url: string;
  stream: boolean;
  signal: AbortSignal;
  headers?: Record<string, string>;
}
declare interface ChatMessageText {
  value: string;
  followingSteps?: string[];
}

// We declare a simple interface for the chat messages
// and the citations
declare interface ChatThreadEntry {
  id: string;
  text: ChatMessageText[];
  citations?: Citation[];
  tools?: { toolName: string, data: any }[];
  followupQuestions?: string[];
  isUserMessage: boolean;
  timestamp: number;
  error?: {
    message: string;
  };
  thoughts?: string;
  reasoning?: string; // Add reasoning property
  dataPoints?: string[];
  rawContent?: string;
  cost?: IPromptCost;
  costs?: IPromptCost[]; // Add costs array to support backend format
  model?: string; // Add model property to store which AI model was used
  files?: MessageFile[]; // Add files property for file attachments
}

declare interface Citation {
  ref: number;
  text: string;
}

declare interface ProcessTextReturn {
  replacedText: string;
  arrays: Array<Array<string> | Array<Citation>>;
}

declare interface ChatRequestOptions {
  approach: string;
  overrides: RequestOverrides;
  type: string;
  question: string;
  messages?: Message[];
  files?: MessageFile[];
}

declare interface RequestOverrides {
  retrieval_mode?: 'hybrid' | 'text' | 'vectors';
  semantic_ranker?: boolean;
  semantic_captions?: boolean;
  exclude_category?: string;
  top?: number;
  temperature?: number;
  prompt_template?: string;
  prompt_template_prefix?: string;
  prompt_template_suffix?: string;
  suggest_followup_questions?: boolean;

  selectedModel?: any;
  aiProvider?: any;
  avatar?: string;
  language?: string;
  knowledge?: string[];
  conversationId?: string;
  conversationTitle?: string;
  userId?: string;
  webSearchEnabled?: boolean;
  deepSearchEnabled?: boolean;
}

declare type MessageRole = 'system' | 'user' | 'assistant' | 'function';

declare interface MessageContent {
  type: 'text' | 'image';
  text?: string;
  image?: string;
}

declare interface MessageFile {
  name: string; 
  size: string; 
  type: string; 
  base64: string;
  tmp?: boolean; // Indicates if this is a temporary file (newly sent) vs a regular file reference
}

declare interface Message {
  role: MessageRole;
  content: string | MessageContent[];
  files?: MessageFile[];
}

declare interface BotResponse {
  conversationId?: string;
  choices: Array<{
    index: number;
    message: BotResponseMessage;
  }>;
  object: 'chat.completion';
}

declare interface ProgressChunk {
  stage?: string;
  message?: string;
  details?: {
    percentage?: number;
    [key: string]: any;
  };
}

declare interface IPromptCost {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  reasoning_tokens: number;
}

declare interface BotResponseChunk {
  tool?: { name: string; data: Record<string, any> };
  citations?: Citation[];
  conversationId?: string;
  cost?: IPromptCost,
  reasoning?: string;
  status?: string;
  progress?: ProgressChunk;
  choices: Array<{
    index: number;
    delta: Partial<BotResponseMessage>;
    finish_reason: string | null;
  }>;
  object: 'chat.completion.chunk';
}

declare type BotResponseMessage = Message & {
  context?: Record<string, any> & {
    data_points?: string[];
    thoughts?: string;
  };
  session_state?: Record<string, any>;
};

declare interface BotResponseError {
  statusCode: number;
  error: string;
  code: string;
  message: string;
}

declare interface IChatSettings {
    imageModel: string | null;
    videoModel: string | null;
    voice: string | null;
}

