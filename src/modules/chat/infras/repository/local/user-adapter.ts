import { IUserQueryRepository } from '../../../interface';
import { UserInfo, UserStatus } from '../../../model/model';
import { UserCondDTO } from '../../../model/dto';

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
    try {
      const users: UserInfo[] = [];

      for (const id of ids) {
        const user = await this.userUseCase.profile(id);
        if (user) {
          users.push(this.mapToUserInfo(user));
        }
      }

      return users;
    } catch (error) {
      return [];
    }
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
