// Modified from the original @replyke/core source.
// Modifications Copyright 2026 Jenova Marie — widened EntityListSortByOptions with the Agora
// ranking algorithms (decay, gravity, wilson, bayesian).
// Licensed under the Apache License, Version 2.0. See the LICENSE and NOTICE files.
export type SortDirection = "asc" | "desc";

export type SortType = "auto" | "numeric" | "text" | "boolean" | "timestamp";

export type SortByReaction = "upvote" | "downvote" | "like" | "love" | "wow" | "sad" | "angry" | "funny";

/**
 * @deprecated Use `"createdAt"` instead. `"new"` is a directional alias kept for
 * backwards compatibility and will be removed in v8. The server still accepts it
 * (it behaves identically to `"createdAt"`) but responds with deprecation headers.
 */
export type DeprecatedNewSortBy = "new";

export type EntityListSortByOptions =
  | "createdAt"
  | "top"
  | "hot"
  | "controversial"
  | DeprecatedNewSortBy
  // Agora ranking algorithms (server lib/ranking.ts): true exponential half-life, HN gravity,
  // Wilson confidence, Bayesian shrunk mean. Numeric tunables ride the optional `rankParams` scalar.
  | "decay"
  | "gravity"
  | "wilson"
  | "bayesian"
  | `metadata.${string}`;

/**
 * Validates a metadata property name for sorting.
 * Metadata property names must contain only alphanumeric characters and underscores.
 *
 * @param propertyName - The property name to validate (without the "metadata." prefix)
 * @throws Error if the property name contains invalid characters
 */
export function validateMetadataPropertyName(propertyName: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(propertyName)) {
    throw new Error(
      `Invalid metadata property name: '${propertyName}'. Only alphanumeric characters and underscores are allowed.`
    );
  }
}

/**
 * Validates a sortBy value, checking metadata property names if applicable.
 *
 * @param sortBy - The sortBy value to validate
 * @throws Error if sortBy uses metadata pattern with invalid property name
 */
export function validateSortBy(sortBy: string): void {
  if (sortBy.startsWith("metadata.")) {
    const propertyName = sortBy.substring(9); // Remove "metadata." prefix
    if (propertyName.length === 0) {
      throw new Error(
        "Invalid metadata sort: property name cannot be empty after 'metadata.'"
      );
    }
    validateMetadataPropertyName(propertyName);
  }
}

/**
 * Validates a sortType value.
 *
 * @param sortType - The sortType value to validate
 * @throws Error if sortType is not a valid type
 */
export function validateSortType(sortType: string): void {
  const validTypes: SortType[] = ["auto", "numeric", "text", "boolean", "timestamp"];
  if (!validTypes.includes(sortType as SortType)) {
    throw new Error(
      `Invalid sortType: '${sortType}'. Must be one of: ${validTypes.join(", ")}`
    );
  }
}
