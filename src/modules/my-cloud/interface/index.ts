import { CloudItem } from "../model";
import { PagingDTO } from "@share/model/paging";

export interface IMyCloudUseCase {
  getItems(
    userId: string,
    type?: string,
    paging?: PagingDTO,
  ): Promise<{ items: CloudItem[]; total: number }>;
  createItem(userId: string, data: any): Promise<CloudItem>;
  deleteItem(userId: string, itemId: string): Promise<void>;
}
