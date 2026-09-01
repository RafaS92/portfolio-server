import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { createClient } from "@supabase/supabase-js";
import { env, requireEnvironmentVariables } from "../config/env.js";

let openai;
let supabase;
let pinecone;

export function getOpenAIClient() {
  requireEnvironmentVariables(["OPENAI_API_KEY"]);
  openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

export function getSupabaseClient() {
  requireEnvironmentVariables(["SUPABASE_URL", "SUPABASE_API_KEY"]);
  supabase ??= createClient(env.SUPABASE_URL, env.SUPABASE_API_KEY);
  return supabase;
}

export function getPineconeClient() {
  requireEnvironmentVariables(["PINECONE_API_KEY"]);
  pinecone ??= new Pinecone({ apiKey: env.PINECONE_API_KEY });
  return pinecone;
}
