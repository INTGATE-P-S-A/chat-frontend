import { newListWithEntryAtIndex } from "../../utils";

// update the citations entry and wrap the citations in a sup tag
export function updateCitationsEntry({
  citations,
  chatEntry,
}: {
  citations: Citation[];
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  const lastMessageEntry = chatEntry;
  const updateCitationReference = (match, capture) => {
    const citation = citations.find((citation) => citation.text === capture);
    if (citation) {
      return `<sup class="citation">${citation.ref}</sup>`;
    }
    return match;
  };

  const textEntrys = lastMessageEntry.text.map((textEntry) => {
    const value = textEntry.value.replaceAll(/\[(.*?)]/g, updateCitationReference);
    const followingSteps = textEntry.followingSteps?.map((step) =>
      step.replaceAll(/\[(.*?)]/g, updateCitationReference),
    );
    return {
      value,
      followingSteps,
    };
  });

  return {
    ...lastMessageEntry,
    text: textEntrys,
    citations,
  };
}

// parse and format citations
export function parseCitations(inputText: string): Citation[] {
  const findCitations = /\[(.*?)]/g;
  const citation: NonNullable<unknown> = {};
  let referenceCounter = 1;

  // extract citation (filename) from the text and map it to a reference number
  inputText.replaceAll(findCitations, (_, capture) => {
    const citationText = capture.trim();
    if (!citation[citationText]) {
      citation[citationText] = referenceCounter++;
    }
    return '';
  });

  return Object.keys(citation).map((text, index) => ({
    ref: index + 1,
    text,
  }));
}

// update the text block entry
export function updateTextEntry({
  chunkValue,
  textBlockIndex,
  chatEntry,
}: {
  chunkValue: string;
  textBlockIndex: number;
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  const { text: lastChatMessageTextEntry } = chatEntry;
  const block = lastChatMessageTextEntry[textBlockIndex] ?? {
    value: '',
    followingSteps: [],
  };

  const value = (block.value || '') + chunkValue;

  return {
    ...chatEntry,
    text: newListWithEntryAtIndex(lastChatMessageTextEntry, textBlockIndex, {
      ...block,
      value,
    }),
  };
}

// update the following steps or followup questions entry
export function updateFollowingStepOrFollowupQuestionEntry({
  chunkValue,
  textBlockIndex,
  stepIndex,
  chatEntry,
}: {
  chunkValue: string;
  textBlockIndex: number;
  stepIndex: number;
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  // following steps and followup questions are treated the same way. They are just stored in different arrays
  const { text: lastChatMessageTextEntry } = chatEntry;
  if (lastChatMessageTextEntry && lastChatMessageTextEntry[textBlockIndex]) {
    const { followingSteps } = lastChatMessageTextEntry[textBlockIndex];
    if (followingSteps) {
      const step = (followingSteps[stepIndex] || '') + chunkValue;
      return {
        ...chatEntry,
        text: newListWithEntryAtIndex(lastChatMessageTextEntry, textBlockIndex, {
          ...lastChatMessageTextEntry[textBlockIndex],
          followingSteps: newListWithEntryAtIndex(followingSteps, stepIndex, step),
        }),
      };
    }
  }

  return chatEntry;
}

// update the tools entry by aggregating tools instead of adding them to text content
export function updateToolsEntry({
  tool,
  chatEntry,
}: {
  tool: { name: string; data: Record<string, any> };
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  const existingTools = chatEntry.tools || [];
  
  return {
    ...chatEntry,
    tools: [...existingTools, { name: tool.name, data: tool.data }],
  };
}