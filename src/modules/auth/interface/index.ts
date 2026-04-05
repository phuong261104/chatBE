import { TokenPayload } from "@share/interface";
import { LoginDTO, RegistrationDTO } from "../model/dto";

export interface IAuthUseCase {
  login(data: LoginDTO): Promise<string>;
  register(data: RegistrationDTO): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload>;
  introspect(token: string): Promise<TokenPayload | null>;
}
