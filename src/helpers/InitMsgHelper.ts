import { parseFullMessage } from "../core/parser/bufferer";
import { parseTool } from "../core/parser/toolsParser";

export class InitMsgHelper {
    static fillInitMessages(initialMessages: ChatThreadEntry[]): ChatThreadEntry[] {
        let thread: ChatThreadEntry[] = [];
        thread = initialMessages.map((message) => {
            // Create a copy of the message to avoid mutating the original
            const processedMessage: ChatThreadEntry = {
                ...message, // Preserve all properties including files
                text: message.text.map(msgTxt => ({
                    ...msgTxt,
                    value: parseFullMessage(msgTxt.value)
                }))
            };

            // Process thoughts if they exist
            if (processedMessage.thoughts) {
                processedMessage.thoughts = parseFullMessage(processedMessage.thoughts);
            }

            // Process tools if they exist
            if (processedMessage.tools && processedMessage.tools.length > 0) {
                // for (const tool of processedMessage.tools) {
                //     const lastTextIndex = processedMessage.text.length - 1;
                //     if (lastTextIndex >= 0) {
                //         processedMessage.text[lastTextIndex].value = parseTool(tool) + processedMessage.text[lastTextIndex].value;
                //     }
                // }

                // processedMessage.tools = processedMessage.tools.map(tool => ({
                //     data: tool.data,
                //     name: tool.toolName,
                // }));
            }

            return processedMessage;
        });

        return thread;
    }
}