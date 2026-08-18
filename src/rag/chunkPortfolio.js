import { loadPortfolio, supportedLocales } from "../content/portfolio.js";

function unique(values) {
  return [...new Set(values)];
}

function buildContext(item, locale) {
  const context = [item.title[locale]];

  if (item.role) context.push(item.role[locale]);
  if (item.organization) context.push(item.organization);
  if (item.location) context.push(item.location[locale]);
  if (item.startDate || item.endDate) {
    const periodLabel = locale === "es" ? "Periodo" : "Period";
    const rangeSeparator = locale === "es" ? "a" : "to";
    const unknownLabel = locale === "es" ? "desconocido" : "unknown";
    const presentLabel = locale === "es" ? "actualidad" : "present";
    context.push(
      `${periodLabel}: ${item.startDate ?? unknownLabel} ${rangeSeparator} ${item.endDate ?? presentLabel}`,
    );
  }

  return `${unique(context).join(" — ")}.`;
}

export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function createPortfolioChunks(portfolio = loadPortfolio()) {
  return portfolio.items.flatMap((item) =>
    item.sections.flatMap((section) =>
      supportedLocales.map((locale) => {
        const text = `${buildContext(item, locale)} ${section.text[locale]}`;

        return {
          id: `${item.id}-${section.id}-${locale}`,
          itemId: item.id,
          sectionId: section.id,
          contentType: item.type,
          locale,
          title: item.title[locale],
          organization: item.organization ?? null,
          role: item.role?.[locale] ?? null,
          topic: section.topic,
          startDate: item.startDate ?? null,
          endDate: item.endDate ?? null,
          technologies: unique([
            ...item.technologies,
            ...(section.technologies ?? []),
          ]),
          tags: unique([...item.tags, ...(section.tags ?? [])]),
          text,
          estimatedTokens: estimateTokens(text),
        };
      }),
    ),
  );
}
