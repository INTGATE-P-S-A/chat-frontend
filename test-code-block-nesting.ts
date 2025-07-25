import { createBufferState, processChunkWithBuffering } from './src/core/parser/bufferer';

// Test case: simulating nested code blocks scenario
function testCodeBlockNesting() {
  console.log('Testing code-block nesting prevention...\n');
  
  // Simulate chunks of text that might cause nesting
  const bufferState = createBufferState();
  let result = '';
  
  const chunks = [
    'Here is some code:\n```typescript\n',
    'function test() {\n',
    '  console.log("Hello");\n',
    '}\n',
    '```\n',
    'And here is more code:\n```javascript\n',
    'console.log("world");\n',
    '```'
  ];
  
  console.log('Processing chunks:');
  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: "${chunk.replace(/\n/g, '\\n')}"`);
    const { processedChunk } = processChunkWithBuffering(chunk, bufferState);
    
    console.log(`  Buffer state: buffering=${bufferState.buffering}, insideCodeViewer=${bufferState.insideCodeViewer}`);
    
    if (processedChunk !== null) {
      result += processedChunk;
      console.log(`  Processed: "${processedChunk.replace(/\n/g, '\\n')}"`);
    } else {
      console.log(`  Processed: null (buffering)`);
    }
    console.log('');
  });
  
  // Handle any remaining buffered content
  if (bufferState.buffering && bufferState.bufferText) {
    if (bufferState.bufferingClosure) {
      result += bufferState.bufferText + bufferState.bufferingClosure;
    } else {
      result += bufferState.bufferText;
    }
  }
  
  console.log('Final result:');
  console.log(result);
  
  // Check for nested code-viewer tags
  const nestedMatches = result.match(/<code-viewer[^>]*>[\s\S]*?<code-viewer[^>]*>/g);
  if (nestedMatches) {
    console.log('\n❌ FAILED: Found nested <code-viewer> tags:');
    nestedMatches.forEach(match => console.log(match));
  } else {
    console.log('\n✅ PASSED: No nested <code-viewer> tags found!');
  }
  
  // Count code-viewer tags
  const openTags = (result.match(/<code-viewer/g) || []).length;
  const closeTags = (result.match(/<\/code-viewer>/g) || []).length;
  console.log(`Open tags: ${openTags}, Close tags: ${closeTags}`);
  
  return { result, nestedMatches };
}

// Run the test
testCodeBlockNesting();
