import { ChatComponent } from "../components/chat-component";
import { FilesHelper } from "./FilesHelper";
import { HandlerHelper } from "./HandlerHelper";

export class EventsHelper {
    static listenToEvents(this: ChatComponent) {
        this.addEventListener('chat:progress', this.handleProgressEvent.bind(this) as EventListener);

        this.addEventListener('rws_modal:chat_settings:close', () => {
            this.showSettings = false;
        });

        this.addEventListener('rws_modal:force_close', () => {
            this.showSettings = false;
        });

        this.addEventListener('rws_modal:ai-assist-suggestions:close', () => {
            this.activeAssist = null;
            this.aiAssistantSignal?.setValue({
                command: 'pass_entry',
                payload: null
            });
        });

        this.addEventListener('code:show', (event) => {
            const theEvent: CustomEvent<{ code: string, id: string, language: string }> = event as CustomEvent<{ code: string, id: string, language: string }>;
            this.handleCodeExpandAside(event, theEvent.detail);
        });

        this.addEventListener('code:stream:ended', (event) => {
            const theEvent: CustomEvent<{ componentId: string }> = event as CustomEvent<{ chunk: string, componentId: string, language: string }>;

            if (this.showCode && this.showCode.id === theEvent.detail.componentId) {
                this.showCode = { ...this.showCode, preview: this.showCode.language === 'html', ended: true };
            }
        });

        this.addEventListener('fullscreen:disable', () => {
            this.isFullscreen = false;

            document.exitFullscreen?.();

            this.dispatchEvent(new CustomEvent('fullscreen-change', {
                detail: { isFullscreen: this.isFullscreen },
                bubbles: true,
                composed: true
            }));
        });

        this.addEventListener('code:preview', (event) => {
            const theEvent: CustomEvent<{ codeId: string }> = event as CustomEvent<{ codeId: string }>;

            if (this.showCode && this.showCode.id === theEvent.detail.codeId) {
                this.showCode = this.showCode ? { ...this.showCode, preview: true } : null;
            }
        });

        this.addEventListener('chat:conversation:start', (event) => {
            const theEvent: CustomEvent<{ conversationId: string, conversationUid?: string }> = event as CustomEvent<{ conversationId: string, conversationUid?: string }>;
            this.convoId = Number(theEvent?.detail?.conversationId || null);
            
            // Set the conversationUid in overrides for the share button
            if (theEvent?.detail?.conversationUid) {
                this.overrides = {
                    ...this.overrides,
                    conversationUid: theEvent.detail.conversationUid
                };
            }
        });

        this.addEventListener('code:update', (event) => {
            const theEvent: CustomEvent<{ chunk: string, componentId: string }> = event as CustomEvent<{ chunk: string, componentId: string, language: string }>;

            if (this.showCode && this.showCode.id === theEvent.detail.componentId) {
                this.showCode = { ...this.showCode, code: this.showCode.code + theEvent.detail.chunk, preview: false };
            }
        });

        this.addEventListener('code:close', (event) => {
            this.collapseAside(event);
        });

        this.addEventListener('chat_settings:submit', (e: Event) => {
            const theEvent = e as CustomEvent<IChatSettings>;

            this.chatSettings = theEvent.detail;
        });

        this.addEventListener('voice-chat:conversation-end', () => {
            this.liveChatOn = false;
            this.showControls = true;
            this.initialMessages = [];
        });

        this.addEventListener('chat_settings:close', (e: Event) => {
            this.collapseAside(e);
        });

        this.addEventListener('prompt-file:pick', (e: Event) => {
            const theEvent = e as CustomEvent<{ event: Event }>;

            FilesHelper.handleAddFile.bind(this)(theEvent.detail.event);
        });
    }

    static listenForFullScreenEvents(this: ChatComponent) {         
        document.addEventListener('fullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.addEventListener('webkitfullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.addEventListener('mozfullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.addEventListener('MSFullscreenChange', HandlerHelper.handleFullscreenChange.bind(this));
    }

    static removeFullScreenEventListeners(this: ChatComponent) {
        document.removeEventListener('fullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.removeEventListener('webkitfullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.removeEventListener('mozfullscreenchange', HandlerHelper.handleFullscreenChange.bind(this));
        document.removeEventListener('MSFullscreenChange', HandlerHelper.handleFullscreenChange.bind(this));
    }
}