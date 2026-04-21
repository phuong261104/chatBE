import { IUserQueryRepository } from "../../../interface";
import { UserInfo, UserStatus } from "../../../model";
import { UserCondDTO } from "../../../model/dto";

import { IUserUseCase } from '@modules/user/interface';

export class UserRepositoryAdapter implements IUserQueryRepository {
  constructor(private readonly userUseCase: IUserUseCase) {}

  async get(id: string): Promise<UserInfo | null> {
    try {
      const user = await this.userUseCase.profile(id);
      if (!user) return null;

      return this.mapToUserInfo(user);
    } catch (error) {
      return null;
    }
  }

  async findByCond(cond: UserCondDTO): Promise<UserInfo | null> {
    try {

      return null;
    } catch (error) {
      return null;
    }
  }

  async findByIds(ids: string[]): Promise<UserInfo[]> {
    if (ids.length === 0) return [];
    const BATCH_SIZE = 50;
    const results: UserInfo[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const user = await this.userUseCase.profile(id);
            return user ? this.mapToUserInfo(user) : null;
          } catch {
            return null;
          }
        }),
      );
      results.push(...batchResults.filter((u): u is UserInfo => u !== null));
    }
    return results;
  }

  private mapToUserInfo(user: any): UserInfo {

    let displayName = user.displayName;

    if (!displayName) {

      displayName = user.username;
    }

    if (!displayName && user.email) {

      displayName = user.email.split('@')[0];
    }

    if (!displayName) {

      displayName = 'Unknown User';
    }

    return {
      id: user.id,
      displayName: displayName,
      avatarUrl: user.avatarUrl,
      status: user.status as UserStatus
    };
  }
}
