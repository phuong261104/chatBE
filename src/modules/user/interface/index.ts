import { IUseCase, TokenPayload } from '@share/interface';
import { User, UserLoginDTO, UserRegistrationDTO } from '../model/model';
import { UserCondDTO, UserUpdateDTO } from '../model/dto';

export interface IUserUseCase extends IUseCase<UserRegistrationDTO, UserUpdateDTO, User, UserCondDTO> {
  login(data: UserLoginDTO): Promise<string>;
  register(data: UserRegistrationDTO): Promise<string>;
  profile(userId: string): Promise<User>;
  verifyToken(token: string): Promise<TokenPayload>;
}
