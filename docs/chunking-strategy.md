# Portfolio chunking strategy

The portfolio uses semantic chunking. Boundaries are selected from the meaning
and structure of the content instead of splitting every fixed number of
characters.

## Rules

- Each section covers one primary topic.
- Each generated chunk starts with identifying context such as the title,
  employer, role, location, and dates.
- English and Spanish are separate chunks so retrieval can stay in the
  visitor's language.
- Item-level and section-level technologies and tags are combined as metadata.
- IDs are deterministic: `<item>-<section>-<locale>`.
- The initial maximum is 350 estimated tokens. Token counts use a simple
  character-based estimate until the Pinecone embedding model is integrated.
- Structured items do not use overlapping text. Overlap is useful when an
  automatic boundary might divide a long narrative, but these boundaries are
  intentionally authored.

## Why this is inspectable

Run `npm run chunks:inspect` before creating embeddings. A human should be able
to read any printed chunk in isolation and understand who, where, and what it
describes. If a chunk mixes unrelated subjects, split its source section. If it
lacks context, improve the source item or context builder.

Chunk size is only a starting hypothesis. Once retrieval exists, an evaluation
set will tell us whether the expected chunk appears in the top results for real
English and Spanish questions.
