import { loadAnswerEvals } from "../src/rag/answerEvals.js";

try {
  const evaluations = loadAnswerEvals();
  const english = evaluations.cases.filter(({ locale }) => locale === "en").length;
  const spanish = evaluations.cases.filter(({ locale }) => locale === "es").length;
  console.log(`Answer evaluations are valid: ${english} English and ${spanish} Spanish cases.`);
} catch (error) {
  console.error(`Answer evaluation validation failed: ${error.message}`);
  process.exitCode = 1;
}
