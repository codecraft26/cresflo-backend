import { env } from "../../config/env.js";

interface EmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
}

class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deterministic-local-embedding";

  async embed(text: string) {
    const values = new Array<number>(env.ADVISOR_EMBEDDING_DIMENSIONS).fill(0);

    for (const [index, character] of Array.from(text).entries()) {
      const bucket = index % values.length;
      values[bucket] = (values[bucket] ?? 0) + character.charCodeAt(0) / 255;
    }

    const magnitude = Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0),
    );

    if (magnitude === 0) {
      return values;
    }

    return values.map((value) => Number((value / magnitude).toFixed(6)));
  }
}

export { DeterministicEmbeddingProvider };
export type { EmbeddingProvider };
