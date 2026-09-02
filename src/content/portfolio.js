import { readFileSync } from "node:fs";

const CONTENT_TYPES = new Set([
  "profile",
  "education",
  "experience",
  "project",
  "service",
  "skill",
]);
const LOCALES = ["en", "es"];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const portfolioUrl = new URL("../../content/portfolio.json", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid portfolio content: ${message}`);
}

function validateLocalizedText(value, fieldName) {
  assert(value && typeof value === "object", `${fieldName} must be an object`);

  for (const locale of LOCALES) {
    assert(
      typeof value[locale] === "string" && value[locale].trim().length > 0,
      `${fieldName}.${locale} must be a non-empty string`,
    );
  }
}

function validateStringArray(value, fieldName) {
  assert(Array.isArray(value), `${fieldName} must be an array`);
  assert(
    value.every((entry) => typeof entry === "string" && entry.trim()),
    `${fieldName} must contain only non-empty strings`,
  );
}

export function validatePortfolio(portfolio) {
  assert(Number.isInteger(portfolio?.version), "version must be an integer");
  assert(Array.isArray(portfolio.items), "items must be an array");

  const itemIds = new Set();
  const archiveOrders = new Set();

  for (const item of portfolio.items) {
    assert(ID_PATTERN.test(item.id), `invalid item id "${item.id}"`);
    assert(!itemIds.has(item.id), `duplicate item id "${item.id}"`);
    itemIds.add(item.id);

    assert(CONTENT_TYPES.has(item.type), `invalid type on "${item.id}"`);
    if (item.type === "project") {
      assert(
        Number.isInteger(item.archiveOrder) && item.archiveOrder > 0,
        `${item.id}.archiveOrder must be a positive integer`,
      );
      assert(
        !archiveOrders.has(item.archiveOrder),
        `duplicate archiveOrder ${item.archiveOrder}`,
      );
      archiveOrders.add(item.archiveOrder);
    } else {
      assert(
        item.archiveOrder === undefined,
        `${item.id}.archiveOrder is only valid on a project`,
      );
    }
    validateLocalizedText(item.title, `${item.id}.title`);
    validateStringArray(item.tags, `${item.id}.tags`);
    validateStringArray(item.technologies, `${item.id}.technologies`);
    assert(
      Array.isArray(item.sections) && item.sections.length > 0,
      `${item.id}.sections must not be empty`,
    );

    if (item.role) validateLocalizedText(item.role, `${item.id}.role`);
    if (item.location) {
      validateLocalizedText(item.location, `${item.id}.location`);
    }

    const sectionIds = new Set();

    for (const section of item.sections) {
      assert(
        ID_PATTERN.test(section.id),
        `invalid section id "${section.id}" on "${item.id}"`,
      );
      assert(
        !sectionIds.has(section.id),
        `duplicate section id "${section.id}" on "${item.id}"`,
      );
      sectionIds.add(section.id);

      assert(
        typeof section.topic === "string" && section.topic.trim(),
        `${item.id}.${section.id}.topic must be a non-empty string`,
      );
      validateLocalizedText(section.text, `${item.id}.${section.id}.text`);

      if (section.tags) {
        validateStringArray(section.tags, `${item.id}.${section.id}.tags`);
      }
      if (section.technologies) {
        validateStringArray(
          section.technologies,
          `${item.id}.${section.id}.technologies`,
        );
      }
    }
  }

  return portfolio;
}

export function loadPortfolio() {
  const portfolio = JSON.parse(readFileSync(portfolioUrl, "utf8"));
  return validatePortfolio(portfolio);
}

export const supportedLocales = Object.freeze([...LOCALES]);
