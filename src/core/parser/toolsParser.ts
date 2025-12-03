
import { escape } from 'html-escaper';

export const parseTool = (tool: { name: string, data: Record<string, any> }): string => {
    const jsonData = JSON.stringify([tool]);
    const escapedData = escape(jsonData);
    return `<rws-tools data='${escapedData}'></rws-tools>`;
}

export const parseTools = (tools: { name: string, data: Record<string, any> }[]): string => {
    if (!tools || tools.length === 0) {
        return '';
    }
    console.log({tools});
    const jsonData = JSON.stringify(tools);
    const escapedData = escape(jsonData);
    return `<rws-tools data='${escapedData}'></rws-tools>`;
}