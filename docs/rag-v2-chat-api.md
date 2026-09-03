# RAG v2 chat API

The new `POST /api/chat` endpoint owns the complete RAG request. The frontend no
longer needs to create an embedding and send it back in a second request.

```text
Frontend message + locale + recent history
                    |
                    v
          validate the request
                    |
                    v
    Pinecone semantic search (top 3)
                    |
                    v
     retrieved bilingual portfolio context
                    |
                    v
       OpenAI grounded answer generation
                    |
                    v
       answer + compact source metadata
```

## Request

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "message": "What experience does Rafa have with React?",
  "locale": "en",
  "history": [
    { "role": "user", "content": "Tell me about Rafa." },
    { "role": "assistant", "content": "Rafa is a full-stack engineer." }
  ]
}
```

- `message` is required and limited to 1,000 characters.
- `locale` is `en` or `es` and defaults to `en`.
- `history` is optional and accepts at most 10 user/assistant messages.
- The frontend should send only recent history, not the current message twice.

## Response

```json
{
  "content": "Rafa has worked with React on web and mobile applications...",
  "locale": "en",
  "sources": [
    {
      "id": "experience-energy-ogre-application-development-en",
      "score": 0.61,
      "title": "Full Stack Developer at Energy Ogre",
      "contentType": "experience",
      "topic": "application-development"
    }
  ]
}
```

The answer powers the chat bubble. The source metadata can power interactive
UI such as an “Explore this experience” card without exposing the entire
retrieved context.

## Grounding and privacy

RafaBot receives three retrieved chunks and instructions to use only supported
portfolio facts. If those chunks do not answer the question, it responds that
the information is unavailable instead of inventing it. OpenAI response storage
is disabled for these generation requests.

The request is stateless on the server. Conversation history belongs to that
visitor and is supplied by the frontend, which prevents one visitor's messages
from leaking into another visitor's conversation.
