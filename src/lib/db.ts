"use client";

import { createStore, del, get, set, values } from "idb-keyval";
import type { Deck } from "./types";

/**
 * Decks live in the browser's IndexedDB, so the app needs no database or login.
 * Use Export/Import on the home page to back up or move to another device.
 */
const store = typeof window !== "undefined" ? createStore("medical-study-companion", "decks") : undefined;

export async function listDecks(): Promise<Deck[]> {
  const decks = (await values<Deck>(store)) ?? [];
  return decks.sort((a, b) => b.createdAt - a.createdAt);
}

export function getDeck(id: string): Promise<Deck | undefined> {
  return get<Deck>(id, store);
}

export function saveDeck(deck: Deck): Promise<void> {
  return set(deck.id, deck, store);
}

export function deleteDeck(id: string): Promise<void> {
  return del(id, store);
}

export function newId(): string {
  return crypto.randomUUID();
}
