import { createBufferState, processChunkWithBuffering } from '../bufferer';
import { BufferingRuleManager } from '../buffering-rules';
import { CodeBlockRule } from '../rules/code-block-rule';

// Test the code block rule with various language scenarios
function testCodeBlockGeneration() {
  console.log('Testing Code Block Generation...\n');

  const testCases = [
    {
      name: 'JavaScript Code Block',
      input: '```javascript\nconst x = 1;\nconsole.log(x);\n```',
      expected: '<code-viewer language="javascript">const x = 1;\nconsole.log(x);\n</code-viewer>'
    },
    {
      name: 'Python Code Block', 
      input: '```python\nprint("Hello World")\n```',
      expected: '<code-viewer language="python">print("Hello World")\n</code-viewer>'
    },
    {
      name: 'TypeScript with alias',
      input: '```ts\ninterface User { name: string; }\n```',
      expected: '<code-viewer language="typescript">interface User { name: string; }\n</code-viewer>'
    },
    {
      name: 'No language specified',
      input: '```\necho "hello"\n```',
      expected: '<code-viewer language="bash">echo "hello"\n</code-viewer>'
    },
    {
      name: 'Unknown language defaults to bash',
      input: '```unknownlang\nsome code\n```',
      expected: '<code-viewer language="bash">some code\n</code-viewer>'
    },
    {
      name: 'Text before code block',
      input: 'Here is some code:\n```javascript\nalert("hi");\n```\nThat was the code.',
      expected: 'Here is some code:\n<code-viewer language="javascript">alert("hi");\n</code-viewer>\nThat was the code.'
    }
  ];

  const ruleManager = new BufferingRuleManager();

  testCases.forEach(testCase => {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Input: ${testCase.input}`);

    const bufferState = createBufferState();
    const { processedChunk } = processChunkWithBuffering(testCase.input, bufferState);

    console.log(`Output: ${processedChunk}`);
    console.log(`Expected: ${testCase.expected}`);
    console.log(`Match: ${processedChunk === testCase.expected ? '✅' : '❌'}`);
    console.log('---\n');
  });
}

// Test chunked processing
function testChunkedCodeBlock() {
  console.log('Testing Chunked Code Block Processing...\n');

  const chunks = [
    'Here is some ',
    '```javascript',
    '\nconst data = {',
    '\n  name: "test"',
    '\n};',
    '\nconsole.log(data);',
    '\n```',
    '\nEnd of code.'
  ];

  const bufferState = createBufferState();
  let result = '';

  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: "${chunk}"`);
    const { processedChunk } = processChunkWithBuffering(chunk, bufferState);
    
    if (processedChunk !== null) {
      result += processedChunk;
      console.log(`Processed: "${processedChunk}"`);
    } else {
      console.log('Buffering...');
    }
    console.log(`Buffer state: buffering=${bufferState.buffering}, insideCodeViewer=${bufferState.insideCodeViewer}`);
    console.log('---');
  });

  console.log(`\nFinal result: ${result}`);
  console.log('Expected: Here is some <code-viewer language="javascript">const data = {\n  name: "test"\n};\nconsole.log(data);\n</code-viewer>\nEnd of code.');
}

// Run tests
testCodeBlockGeneration();
testChunkedCodeBlock();
