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
  tools?: { name: string, data: any }[];
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
  user?: {
    id: string;
    username: string;
    name?: string;
    last_name?: string;
    profile_pic?: {
      filename: string;
    };
  } | null; // Add user property to match backend ChatThreadEntry
}

declare interface IRWSUser {
  id: string | number;
  username: string;
  name?: string;
  last_name?: string;
  profile_pic?: {
    filename: string;
  };
  accountBalance: {
    credits: number;
  };
  accountGrade: {
    advancedPrompts: boolean;
    promptAssist: boolean;
    maxAvatars: number | null; // null means infinite
    maxUsers: number | null; // null means infinite
    maxProjectsCount: number | null; // null means infinite
    maxKnowledgeEntries: number | null; // null means infinite
    antiHallucination: boolean;
    advancedReports: boolean;
    chatThreadSharing: boolean;
    customBranding: boolean;
    widgets: boolean;
    customAiModels: number | null; // null means infinite
    voiceAgent: boolean;
    writingStyles: boolean;
  }
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
  knowledge?: (string | number)[];
  conversationId?: string;
  conversationUid?: string;
  conversationTitle?: string;
  userId?: string;
  webSearchEnabled?: boolean;
  deepSearchEnabled?: boolean;
  writingStyle?: string[];
  chatSettings?: IChatSettings;
  promptSlots?: IPromptSlotsContent;
}

declare type MessageRole = 'system' | 'user' | 'assistant' | 'function';

declare interface MessageContent {
  type: 'text' | 'image';
  text?: string;
  image?: string;
}

declare interface MessageFile {
  id: string | number;
  filename: string;
  originalName?: string;
  size: number;
  mimeType: string;
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
  chatLearning: boolean;
}

declare interface IRWSAiAssistComponent extends HTMLElement {
  getExternalSignal(): IExternalAssistSignal | null;
  bindInputSource(input: HTMLTextAreaElement): Promise<string>;
  updateContextFromMessages(context: Message[]): void;
  analyzeAfterLLMResponse(): Promise<void>;
  clearPromptWritingTimeout(): void;
  setLLMStreaming(streaming: boolean): void;
}

declare interface IRWSAutocompleteTriggerComponent extends HTMLElement {
 bindTextarea(textarea: HTMLTextAreaElement | null): void;
}

declare enum ActiveAssistSignalType {
  MESSAGE = 'message',
  STATUS = 'status',
  ACTION = 'action'
}

declare enum ActiveAssistActionContext {
  TEXT_INSERTION = 'text_insertion',
  KDB_ATTACHMENT = 'kdb_attachment'
}

declare interface IActiveAssistTextActionParams {
  offset: number;
  length: number;
  text: string;
}

declare interface IActiveAssistKDBAttachmentActionParams {
  kdbId: string | number;
  title: string;
  description: string;
  file: {
    name: string;
    mimeType: string;
    size: number;
  }
}

declare interface IActiveAssistAction {
  label: string;
  context: ActiveAssistActionContext;
  params: IActiveAssistTextActionParams & IActiveAssistKDBAttachmentActionParams;
}

declare interface IActiveAssist {
  type: ActiveAssistSignalType;
  text?: string;
  actions?: IActiveAssistAction[];
}

declare interface IAISuggestion {
  id: string;
  title: string;
  description: string;
  text: string;
  context: string;
  kdb?: IActiveAssistKDBAttachmentActionParams
}


declare interface IAssistSignalPayload {
    command: 'attach_file' | 'pass_entry' | 'add_file' | 'open_knowledge_picker_create_form' | 'open_knowledge_picker';
    payload?: any;
}

declare interface IExternalAssistSignal {
  getValue(): IAssistSignalPayload | null;
  setValue(value: IAssistSignalPayload | null): void;
  value$: {
    subscribe(callback: (value: IAssistSignalPayload | null) => void): void;
  };
}

declare interface IExternalBalanceSignal {
  getValue(): number | null;
  setValue(value: number | null): void;
  value$: {
    subscribe(callback: (value: number | null) => void): void;
  };
}

declare interface IPromptSlotsContent {
  conversation_context: string | null,
  conversation_goal: string | null,
  conversation_target: string | null,
  conversation_format: string | null
}