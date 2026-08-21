const chunkText = (content: string, maxChunkLength = 500) => {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).trim().length <= maxChunkLength) {
      currentChunk = `${currentChunk} ${sentence}`.trim();
      continue;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    if (sentence.length <= maxChunkLength) {
      currentChunk = sentence;
      continue;
    }

    for (let index = 0; index < sentence.length; index += maxChunkLength) {
      chunks.push(sentence.slice(index, index + maxChunkLength).trim());
    }

    currentChunk = "";
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.filter((chunk) => chunk.length >= 20);
};

export { chunkText };
