import { searchPortfolio } from "../src/rag/pineconeStore.js";

function parseArguments(argumentsList) {
  let locale = "en";
  const questionParts = [];

  for (const argument of argumentsList) {
    if (argument.startsWith("--locale=")) {
      locale = argument.slice("--locale=".length);
    } else {
      questionParts.push(argument);
    }
  }

  return { locale, question: questionParts.join(" ") };
}

const { locale, question } = parseArguments(process.argv.slice(2));

if (!question) {
  console.error(
    'Usage: npm run pinecone:search -- --locale=en "What has Rafa built?"',
  );
  process.exitCode = 1;
} else {
  try {
    const results = await searchPortfolio(question, { locale, topK: 3 });

    if (results.length === 0) {
      console.log("No matching chunks found.");
    }

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.id} (${result.score.toFixed(4)})`);
      console.log(result.chunk_text);
    });
  } catch (error) {
    console.error(`Pinecone search failed: ${error.message}`);
    process.exitCode = 1;
  }
}
