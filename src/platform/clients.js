import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

export function createOpenAIClient(apiKey) {
  return new OpenAI({ apiKey });
}

export function createPineconeClient(apiKey) {
  return new Pinecone({ apiKey });
}
