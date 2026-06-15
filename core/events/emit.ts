import type { DomainEvent } from './types';

type Handler = (event: DomainEvent) => void | Promise<void>;
const handlers: Map<string, Handler[]> = new Map();

export function on(eventType: DomainEvent['type'], handler: Handler): void {
  const list = handlers.get(eventType) ?? [];
  list.push(handler);
  handlers.set(eventType, list);
}

export async function emit(event: DomainEvent): Promise<void> {
  const list = handlers.get(event.type) ?? [];
  await Promise.all(list.map((handler) => handler(event)));
}
