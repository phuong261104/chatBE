import {
  ICommandRepository,
  IQueryRepository,
  IRepository,
} from "@share/interface";
import { ModelStatus } from "@share/model/base-model";
import { PagingDTO } from "@share/model/paging";
import type { Model } from "mongoose";

/**
 * Notes:
 * - Assumes your Mongoose schema uses `timestamps: true` => provides `createdAt`, `updatedAt`
 * - Soft delete implemented by setting `status = ModelStatus.DELETED`
 * - Uses `_id` as Mongo primary key, but exposes/accepts `id: string`
 */

export abstract class BaseRepositoryMongoose<
  Entity,
  Cond,
  UpdateDTO,
> implements IRepository<Entity, Cond, UpdateDTO> {
  constructor(
    readonly queryRepo: IQueryRepository<Entity, Cond>,
    readonly cmdRepo: ICommandRepository<Entity, UpdateDTO>,
  ) {}

  async get(id: string): Promise<Entity | null> {
    return await this.queryRepo.get(id);
  }

  async findByCond(cond: Cond): Promise<Entity | null> {
    return await this.queryRepo.findByCond(cond);
  }

  async list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>> {
    return await this.queryRepo.list(cond, paging);
  }

  async listByIds(ids: string[]): Promise<Array<Entity>> {
    return await this.queryRepo.listByIds(ids);
  }

  async insert(data: Entity): Promise<boolean> {
    return await this.cmdRepo.insert(data);
  }

  async update(id: string, data: UpdateDTO): Promise<boolean> {
    return await this.cmdRepo.update(id, data);
  }

  async delete(id: string, isHard: boolean): Promise<boolean> {
    return await this.cmdRepo.delete(id, isHard);
  }
}

export abstract class BaseQueryRepositoryMongoose<
  Entity,
  Cond,
> implements IQueryRepository<Entity, Cond> {
  constructor(
    readonly model: Model<any>,
    readonly defaultSort: any = { _id: -1 },
  ) {}

  /**
   * Convert mongoose document/plain object:
   * - to plain object
   * - map `_id` -> `id`
   */
  protected toEntity(doc: any): Entity {
    if (!doc) return doc;

    const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;

    // Mongoose might include both _id and id (virtual). Ensure consistent.
    const { _id, __v, ...rest } = obj;
    return {
      ...rest,
      id: String(_id),
    } as Entity;
  }

  async get(id: string): Promise<Entity | null> {
    const data = await this.model.findById(id).lean().exec();

    if (!data) return null;

    return this.toEntity(data);
  }

  async findByCond(cond: Cond): Promise<Entity | null> {
    const data = await this.model
      .findOne(cond as any)
      .lean()
      .exec();

    if (!data) return null;

    return this.toEntity(data);
  }

  async list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>> {
    const { page, limit } = paging;

    // soft-delete filter like Sequelize version
    const condMongo: any = {
      ...(cond as any),
      status: { $ne: ModelStatus.DELETED },
    };

    const total = await this.model.countDocuments(condMongo).exec();
    paging.total = total;

    const rows = await this.model
      .find(condMongo)
      .sort(this.defaultSort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return rows.map((row) => this.toEntity(row));
  }

  async listByIds(ids: string[]): Promise<Array<Entity>> {
    const rows = await this.model
      .find({ _id: { $in: ids } })
      .lean()
      .exec();

    return rows.map((row) => this.toEntity(row));
  }
}

export abstract class BaseCommandRepositoryMongoose<
  Entity,
  UpdateDTO,
> implements ICommandRepository<Entity, UpdateDTO> {
  constructor(readonly model: Model<any>) {}

  async insert(data: Entity): Promise<boolean> {
    // Convert id to _id for Mongoose
    const mongooseData = { ...data };
    if ((mongooseData as any).id) {
      (mongooseData as any)._id = (mongooseData as any).id;
      delete (mongooseData as any).id;
    }
    await this.model.create(mongooseData as any);
    return true;
  }

  async update(id: string, data: UpdateDTO): Promise<boolean> {
    await this.model
      .updateOne({ _id: id }, data as any, { runValidators: true })
      .exec();
    return true;
  }

  async delete(id: string, isHard: boolean = false): Promise<boolean> {
    if (!isHard) {
      await this.model
        .updateOne({ _id: id }, { status: ModelStatus.DELETED })
        .exec();
    } else {
      await this.model.deleteOne({ _id: id }).exec();
    }
    return true;
  }
}
