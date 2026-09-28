export interface CustomTyperConfig {
    startAfterChars?: number; // start typing after this many chars have been buffered; 0 = immediately
    charIntervalMs?: number;  // ms between each typed character
    onDone?: () => void;
    onFlush?: (typedText: string) => void;
}

export interface CustomTyper {
    type(text: string): void;
    destroy(): void;
    isDone(): boolean;
    getTypedText(): string;
    getBuffer(): string;
    setTypedText(text: string): void;
    finish(): void;
}

function isPotentialTagStart(text: string, pos: number): boolean {
    if (pos < 0 || pos >= text.length) {
        return false;
    }
    const next = text[pos + 1];
    if (next === undefined) {
        return true;
    }
    return /[a-zA-Z\/!]/.test(next);
}

function isPotentialEntity(text: string, pos: number, end: number): boolean {
    const semi = text.indexOf(';', pos);
    if (semi !== -1 && semi < end) {
        return false;
    }
    const slice = text.slice(pos + 1, end);
    return slice.length === 0 || /^[a-zA-Z0-9#]+$/.test(slice);
}

function getSafeCutEnd(text: string, maxLen: number): number {
    let end = Math.min(text.length, Math.max(0, maxLen));

    const lastOpen = text.lastIndexOf('<', end - 1);
    const lastClose = text.lastIndexOf('>', end - 1);
    if (lastOpen > lastClose && isPotentialTagStart(text, lastOpen)) {
        end = lastOpen;
    }

    const lastAmp = text.lastIndexOf('&', end - 1);
    if (lastAmp !== -1 && isPotentialEntity(text, lastAmp, end)) {
        end = lastAmp;
    }

    return end;
}

function getNextSafeFlushEnd(text: string, minChars: number): number {
    const safeEnd = getSafeCutEnd(text, minChars);
    if (safeEnd > 0) {
        return safeEnd;
    }

    const lastOpen = text.lastIndexOf('<', minChars - 1);
    const lastClose = text.lastIndexOf('>', minChars - 1);
    if (lastOpen > lastClose && isPotentialTagStart(text, lastOpen)) {
        const tagEnd = text.indexOf('>', lastOpen);
        if (tagEnd !== -1) {
            return tagEnd + 1;
        }
    }

    const lastAmp = text.lastIndexOf('&', minChars - 1);
    if (lastAmp !== -1 && isPotentialEntity(text, lastAmp, minChars)) {
        const semi = text.indexOf(';', lastAmp);
        if (semi !== -1) {
            return semi + 1;
        }
    }

    return 0;
}

export function getSafeHtmlPrefix(html: string, maxLen?: number): string {
    const end = getSafeCutEnd(html, maxLen ?? html.length);
    return html.slice(0, end);
}

export function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

export function createCustomTyper(
    messageArea: HTMLElement,
    config: CustomTyperConfig = {}
): CustomTyper {
    const startAfterChars = config.startAfterChars ?? 0;
    const charIntervalMs = Math.max(config.charIntervalMs ?? 25, 1);

    // How many characters to write per animation frame to hit the target speed.
    // At 60fps (~16.7ms/frame), charIntervalMs=25 => ~1 char every 1.5 frames.
    const charsPerFrame = Math.max(1, Math.round(charIntervalMs / 16));
    const framesPerFlush = Math.max(1, Math.round(16 / charIntervalMs)) || 1;

    let buffer = '';
    let displayed = '';
    let rafId: number | null = null;
    let started = false;
    let done = true;
    let frameCount = 0;

    function flush(charsToWrite: number) {
        if (buffer.length === 0) {
            done = true;
            return;
        }

        const flushEnd = getNextSafeFlushEnd(buffer, charsToWrite);
        if (flushEnd <= 0) {
            return;
        }

        const flushable = buffer.slice(0, flushEnd);
        buffer = buffer.slice(flushEnd);
        displayed += flushable;
        messageArea.innerHTML = displayed;
        if (config.onFlush) {
            config.onFlush(displayed);
        }
        done = buffer.length === 0;
    }

    function tick() {
        if (buffer.length === 0) {
            rafId = null;
            console.log('[bufferTyping] tick buffer empty, done:', done);
            if (done && config.onDone) {
                console.log('[bufferTyping] invoking onDone');
                config.onDone();
            }
            return;
        }

        frameCount++;
        if (frameCount % framesPerFlush === 0) {
            flush(charsPerFrame);
        }

        rafId = requestAnimationFrame(tick);
    }

    function start() {
        if (started) {
            return;
        }
        started = true;
        if (buffer.length > 0) {
            rafId = requestAnimationFrame(tick);
        }
    }

    return {
        type(text: string) {
            if (!text) {
                return;
            }
            console.log('[bufferTyping] type', { textLength: text.length, started, bufferLength: buffer.length });
            done = false;
            buffer += text;
            if (!started && buffer.length >= startAfterChars) {
                start();
            } else if (started && !rafId && buffer.length > 0) {
                rafId = requestAnimationFrame(tick);
            }
        },
        destroy() {
            console.log('[bufferTyping] destroy');
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            started = false;
            buffer = '';
            displayed = '';
            done = true;
        },
        isDone() {
            return done && buffer.length === 0;
        },
        getTypedText() {
            return displayed;
        },
        getBuffer() {
            return buffer;
        },
        setTypedText(text: string) {
            displayed = text;
            buffer = '';
            done = true;
            messageArea.innerHTML = displayed;
        },
        finish() {
            console.log('[bufferTyping] finish');
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            started = false;
            if (buffer.length > 0) {
                displayed += buffer;
                buffer = '';
                messageArea.innerHTML = displayed;
                if (config.onFlush) {
                    config.onFlush(displayed);
                }
            }
            done = true;
            if (config.onDone) {
                console.log('[bufferTyping] finish invoking onDone');
                config.onDone();
            }
        }
    };
}

export function bufferTyping(typer: CustomTyper | null, text: string): void {
    if (!typer || !text) {
        return;
    }
    typer.type(text);
}
