/** Packaging prose must never become an exposure, even when an upstream parser labels it an ingredient. */
export function isPackagingText(text: string): boolean {
  return /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|[©®™])|\b(?:e[- ]?mail|website|www|telephone|tel\s*:|fax|customer\s+(?:care|service)|contact\s+us|allergy\s+advice|allergen\s+(?:advice|information)|may\s+contain|made\s+in|product\s+of|manufactured\s+(?:by|for|in)|distributed\s+by|imported\s+by|registered\s+(?:office|trademark)|all\s+rights|copyright|best\s+before|keep\s+refrigerated|serving\s+suggestion|nutrition\s+facts|recycl\w*)\b|^\s*(?:tm|inc\.?|ltd\.?|llc|plc|allergy|address)\s*[!.:]*$|\b\d+\s+[a-z ]+\s+(?:street|road|avenue|lane|drive|industrial\s+estate)\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(text);
}

/** Stop at a prose boundary within a record without losing a genuine ingredient before it. */
export function ingredientPrefix(text: string): string {
  return text.split(/\b(?:allergy\s+advice|for\s+allergens|may\s+contain|made\s+in|product\s+of|manufactured\s+(?:by|for)|distributed\s+by|imported\s+by|e[- ]?mail|website|nutrition(?:al)?\s+(?:information|facts)|storage|best\s+before)\b|https?:\/\/|www\./i)[0].trim().replace(/[.!:;]+$/, '').trim();
}
