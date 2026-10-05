export interface CustomTyperConfig {
    charIntervalMs?: number;  // unused, kept for compatibility
    typingTempoDelay?: number;     // ms per character; lower = faster, 0/unset = max speed
    autoStart?: boolean;      // start typing immediately on type(); default true
    onDone?: () => void;
    onFlush?: (typedText: string) => void;
}

export interface CustomTyper {
    type(text: string): void;
    start(): void;
    destroy(): void;
    isDone(): boolean;
    getTypedText(): string;
    getBuffer(): string;
    setTypedText(text: string): void;
    setMessageArea(messageArea: HTMLElement): void;
    finish(): void;
}

class BufferTyper implements CustomTyper {
    private messageArea: HTMLElement;
    private config: CustomTyperConfig;
    private queue: string[] = [];
    private displayed: string = '';
    private htmlBuffer: string = '';
    private rafId: number | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private started: boolean = false;
    private done: boolean = true;
    private onDoneCalled: boolean = false;
    private destroyed: boolean = false;

    constructor(messageArea: HTMLElement, config: CustomTyperConfig = {}) {
        this.messageArea = messageArea;
        this.config = config;
    }

    type(text: string): void {
        if (!text || this.destroyed) {
            return;
        }
        this.done = false;
        this.onDoneCalled = false;
        this.queue.push(text);

        if (!this.started) {
            if (this.config.autoStart !== false) {
                this.start();
            }
        } else if (!this.rafId && !this.timeoutId) {
            this.scheduleTick();
        }
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.scheduleTick();
    }

    private scheduleTick(): void {
        if (this.rafId || this.timeoutId) {
            return;
        }

        if (this.config.typingTempoDelay && this.config.typingTempoDelay > 0) {
            this.timeoutId = setTimeout(() => {
                this.timeoutId = null;
                this.tick();
            }, this.config.typingTempoDelay);
        } else {
            this.rafId = requestAnimationFrame(() => this.tick());
        }
    }

    private tick(): void {
        this.rafId = null;

        if (this.queue.length === 0 && this.htmlBuffer.length === 0) {
            this.done = true;
            this.invokeOnDone();
            return;
        }

        this.flush();

        if (this.queue.length > 0) {
            this.scheduleTick();
        } else if (this.htmlBuffer.length > 0) {
            // Waiting for more chunks to close the open HTML tag.
            this.done = false;
        } else {
            this.done = true;
            this.invokeOnDone();
        }
    }

    private flush(): void {
        // Continue collecting a previously started HTML tag.
        if (this.htmlBuffer.length > 0) {
            this.collectTag();
            return;
        }

        if (this.queue.length === 0) {
            this.done = true;
            return;
        }

        // Drain one character from the front of the queue in strict order.
        const chunk = this.queue[0];
        const char = chunk[0];
        this.queue[0] = chunk.slice(1);
        if (this.queue[0].length === 0) {
            this.queue.shift();
        }

        if (char === '<') {
            this.htmlBuffer = char;
            this.collectTag();
        } else {
            this.displayed += char;
            this.updateDOM();
        }

        this.done = this.queue.length === 0 && this.htmlBuffer.length === 0;
    }

    private collectTag(): void {
        // htmlBuffer starts with '<'. Drain chunks until we find the closing '>'.
        while (this.queue.length > 0 && this.htmlBuffer.indexOf('>') === -1) {
            this.htmlBuffer += this.queue.shift()!;
        }

        const closeIdx = this.htmlBuffer.indexOf('>');
        if (closeIdx === -1) {
            // Incomplete tag; keep it buffered and do not display.
            this.done = false;
            return;
        }

        // Flush the complete tag and put any trailing text back at the queue front.
        const tag = this.htmlBuffer.slice(0, closeIdx + 1);
        const remainder = this.htmlBuffer.slice(closeIdx + 1);
        this.displayed += tag;
        this.htmlBuffer = '';
        if (remainder) {
            this.queue.unshift(remainder);
        }
        this.updateDOM();

        this.done = this.queue.length === 0 && this.htmlBuffer.length === 0;
    }

    private updateDOM(): void {
        this.messageArea.innerHTML = this.displayed;
        if (this.config.onFlush) {
            this.config.onFlush(this.displayed);
        }
    }

    private invokeOnDone(): void {
        if (!this.onDoneCalled && this.config.onDone) {
            this.onDoneCalled = true;
            this.config.onDone();
        }
    }

    destroy(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.started = false;
        this.queue = [];
        this.displayed = '';
        this.htmlBuffer = '';
        this.done = true;
        this.onDoneCalled = false;
        this.destroyed = true;
    }

    isDone(): boolean {
        return this.done && this.queue.length === 0 && this.htmlBuffer.length === 0;
    }

    getTypedText(): string {
        return this.displayed;
    }

    getBuffer(): string {
        return this.queue.join('');
    }

    setTypedText(text: string): void {
        this.displayed = text;
        this.queue = [];
        this.htmlBuffer = '';
        this.done = true;
        this.messageArea.innerHTML = this.displayed;
    }

    setMessageArea(messageArea: HTMLElement): void {
        this.messageArea = messageArea;
        this.messageArea.innerHTML = this.displayed;
    }

    finish(): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.started = false;

        if (this.queue.length > 0 || this.htmlBuffer.length > 0) {
            const remaining = this.htmlBuffer + this.queue.join('');
            this.displayed += remaining;
            this.queue = [];
            this.htmlBuffer = '';
            this.messageArea.innerHTML = this.displayed;
            if (this.config.onFlush) {
                this.config.onFlush(this.displayed);
            }
        }

        this.done = true;
        this.invokeOnDone();
    }
}

export function createCustomTyper(
    messageArea: HTMLElement,
    config: CustomTyperConfig = {}
): CustomTyper {
    return new BufferTyper(messageArea, config);
}

export function bufferTyping(typer: CustomTyper | null, text: string): void {
    if (!typer || !text) {
        return;
    }
    typer.type(text);
}
