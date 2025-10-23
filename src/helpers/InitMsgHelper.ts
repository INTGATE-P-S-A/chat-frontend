import { parseFullMessage } from "../core/parser/bufferer";
import { parseTool } from "../core/parser/toolsParser";

export class InitMsgHelper {
    static fillInitMessages(initialMessages: ChatThreadEntry[]) {
        let thread: ChatThreadEntry[] = [];
        thread = initialMessages.map((message) => {
            let i = 0;
            for (const msgTxt of message.text) {
                message.text[i].value = parseFullMessage(msgTxt.value);
                i++;
            }

            if (message.thoughts) {
                message.thoughts = parseFullMessage(message.thoughts);
            }

            if (message.tools) {
                for (const tool of message.tools) {
                    message.text[message.text.length - 1].value = parseTool({ name: tool.toolName, data: tool.data }) + message.text[message.text.length - 1].value
                }

            }

            return message;
        });

        return thread;
    }
}