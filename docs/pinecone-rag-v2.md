# Pinecone RAG v2

This stage adds a second retrieval path without replacing the working Supabase
chatbot. It lets us measure Pinecone first and switch the API only after the new
retrieval quality is acceptable.

## What happens to the portfolio data

```text
content/portfolio.json
        |
        v
createPortfolioChunks()       40 bilingual semantic chunks
        |
        v
toPineconeRecord()            flat records + searchable metadata
        |
        v
Pinecone integrated embedding llama-text-embed-v2
        |
        v
development-v1 namespace     isolated, replaceable dataset version
```

Pinecone embeds the `chunk_text` field during both ingestion and search. This
means this version does not need to call OpenAI to create vectors or manage the
embedding dimensions itself. Every record still has a stable ID and metadata,
including its language, source item, section, topic, technologies, and tags.

English and Spanish are stored as separate chunks. Search applies a `locale`
filter, preventing an English question from receiving Spanish context (or the
reverse) merely because the meanings are similar.

## Configuration

Create a Pinecone API key and add these values to `.env`:

```dotenv
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=rafa-portfolio
PINECONE_NAMESPACE=development-v1
```

`PINECONE_API_KEY` is optional while the server still uses Supabase. It is
required only for the Pinecone commands. The index and namespace have safe
defaults, but explicit values make each environment easier to understand.

The synchronization command creates an on-demand index if it does not exist.
It uses Pinecone's `llama-text-embed-v2` model in AWS `us-east-1`, enables
deletion protection, and makes `locale` filterable.

## Run the learning workflow

1. Validate the canonical source and the evaluation questions.

   ```bash
   npm run content:validate
   npm run evals:validate
   ```

2. Synchronize all chunks. Running this again is safe: matching IDs are
   updated, and obsolete IDs in this namespace are deleted.

   ```bash
   npm run pinecone:sync
   ```

3. Wait a few seconds for Pinecone's eventual consistency, then inspect a
   real search.

   ```bash
   npm run pinecone:search -- --locale=en "What projects has Rafa built?"
   npm run pinecone:search -- --locale=es "¿Qué experiencia tiene Rafa con React?"
   ```

4. Run all representative searches and calculate Recall@3.

   ```bash
   npm run evals:retrieval
   ```

   Recall@3 answers: “For what percentage of our questions did at least one
   expected chunk appear in the first three results?” The command requires at
   least 90% by default. Change the experiment threshold with, for example,
   `EVAL_MIN_RECALL=0.95 npm run evals:retrieval`.

The two out-of-scope questions are reported separately. Their top scores will
help us choose a confidence threshold later; they are not included in recall
because there is intentionally no correct portfolio chunk for them.

## Why Supabase remains for now

The public chat endpoints still use their original Supabase retrieval path.
That gives us a controlled migration:

1. synchronize Pinecone;
2. measure retrieval and improve weak chunks or questions;
3. connect Pinecone retrieval to answer generation;
4. compare complete answers;
5. remove the legacy embedding and Supabase vector code only after cutover.

This avoids changing the visitor experience before we have evidence that the
new retrieval works better.
