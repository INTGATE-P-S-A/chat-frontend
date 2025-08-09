import { createBufferState, processChunkWithBuffering } from '../bufferer';

// Test with the exact chunks provided by the user
function testUserChunks() {
  console.log('Testing User Provided Chunks...\n');

  const chunks = [
    '```',           // First chunk: opening backticks
    'html',          // Second chunk: language
    '\n',            // Third chunk: newline
    '<',             // Fourth chunk: start of HTML
    'main',          // Fifth chunk: continue HTML
    '>\n',           // Sixth chunk: close tag and newline
    '  ',            // Seventh chunk: indentation
    '<',             // Eighth chunk: start of next tag
    'h',             // Ninth chunk: continue tag
    '1',             // Tenth chunk: complete h1
    '>Hello',        // Eleventh chunk: content
    ' World',        // Twelfth chunk: more content
    '</',            // Thirteenth chunk: closing tag start
    'h',             // Fourteenth chunk: continue closing
    '1',             // Fifteenth chunk: complete closing
    '>\n'            // Sixteenth chunk: close tag and newline
  ];

  const bufferState = createBufferState();
  let result = '';
  let codeViewerCreated = false;

  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: "${chunk}"`);
    const { processedChunk } = processChunkWithBuffering(chunk, bufferState, (bufferInfo, chunkText) => {
      if (bufferInfo.buffering && bufferInfo.bufferingClosure === '</code-viewer>') {
        console.log(`  → updateRenderer called with: "${chunkText}"`);
        if (!codeViewerCreated) {
          console.log('  → Code-viewer component should be created and streaming should start');
          codeViewerCreated = true;
        }
      }
    });
    
    if (processedChunk !== null) {
      result += processedChunk;
      console.log(`  Processed: "${processedChunk}"`);
      if (processedChunk.includes('<code-viewer')) {
        console.log('  ✅ Code-viewer tag created!');
        codeViewerCreated = true;
      }
    } else {
      console.log('  Buffering...');
    }
    
    console.log(`  Buffer state: buffering=${bufferState.buffering}, closure=${bufferState.bufferingClosure}`);
    console.log('---');
  });

  console.log(`\nFinal result: ${result}`);
  console.log(`Code-viewer created: ${codeViewerCreated ? '✅' : '❌'}`);
  
  // Test that it creates the expected structure
  const expectedPattern = /<code-viewer componentId="[a-z0-9]+" language="html">/;
  const hasCorrectStructure = expectedPattern.test(result);
  console.log(`Correct structure: ${hasCorrectStructure ? '✅' : '❌'}`);
  
  if (hasCorrectStructure) {
    const match = result.match(/<code-viewer[^>]*>(.*)/s);
    if (match) {
      console.log(`Code content: "${match[1]}"`);
    }
  }
}

// Test with complete code block (should also work)
function testCompleteCodeBlock() {
  console.log('\n\nTesting Complete Code Block...\n');
  
  const completeChunk = '```html\n<main>\n  <h1>Hello World</h1>\n</main>\n```';
  const bufferState = createBufferState();
  
  const { processedChunk } = processChunkWithBuffering(completeChunk, bufferState);
  
  console.log(`Input: ${completeChunk}`);
  console.log(`Output: ${processedChunk}`);
  
  const expectedPattern = /<code-viewer[^>]*language="html">[^<]*<main>/;
  const hasCorrectStructure = expectedPattern.test(processedChunk || '');
  console.log(`Correct structure: ${hasCorrectStructure ? '✅' : '❌'}`);
}

// Run tests
testUserChunks();
testCompleteCodeBlock();
