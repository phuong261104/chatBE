import { IUseCase } from '@share/interface';
import { BlockCreateDTO, BlockUpdateDTO, BlockCondDTO, Block } from '../model';

export interface IBlockUseCase extends IUseCase<BlockCreateDTO, BlockUpdateDTO, Block, BlockCondDTO> {
  blockUser(blockerId: string, blockedUserId: string): Promise<string>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<boolean>;
  isBlocked(blockerId: string, blockedUserId: string): Promise<boolean>;
  getBlockedUsers(blockerId: string): Promise<Block[]>;
}
