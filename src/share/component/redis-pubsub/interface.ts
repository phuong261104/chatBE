import { AppEvent } from "@/share/model/event";

export type EventHandler = (msg: string) => void;

export interface IEventPublisher {
  publish<T>(event: AppEvent<T>): Promise<void>;
}
