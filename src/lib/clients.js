import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { env, requireEnvironmentVariables } from "../config/env.js";

let openai;
let pinecone;

export function getOpenAIClient() {
  requireEnvironmentVariables(["OPENAI_API_KEY"]);
  openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

export function getPineconeClient() {
  requireEnvironmentVariables(["PINECONE_API_KEY"]);
  pinecone ??= new Pinecone({ apiKey: env.PINECONE_API_KEY });
  return pinecone;
}
