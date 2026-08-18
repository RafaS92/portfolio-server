import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_API_KEY,
);
