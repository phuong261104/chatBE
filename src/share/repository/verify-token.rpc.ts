// import axios from "axios";
// import { ITokenIntrospect, TokenIntrospectResult } from "../interface";

// export class TokenIntrospectRPCClient implements ITokenIntrospect {
//   constructor(private readonly url: string) {}

//   async introspect(token: string): Promise<TokenIntrospectResult> {
//     try {
//       const { data } = await axios.post(`${this.url}`, { token });
//       const { sub, role } = data.data;

//       return {
//         payload: { sub, role },
//         isOk: true,
//       };
//     } catch (error) {
//       return {
//         payload: null,
//         error: (error as Error),
//         isOk: false,
//       };
//     }
//   }
// }

import jwt from 'jsonwebtoken';
import { ITokenIntrospect, TokenIntrospectResult } from '../interface';

export class TokenIntrospectLocal implements ITokenIntrospect {
  constructor(private readonly secretKey: string) {}

  async introspect(token: string): Promise<TokenIntrospectResult> {
    try {
      const decoded = jwt.verify(token, this.secretKey) as any;

      return {
        payload: {
          sub: decoded.sub || decoded._id,
          role: decoded.role
        },
        isOk: true
      };
    } catch (error) {
      return {
        payload: null,
        error: error as Error,
        isOk: false
      };
    }
  }
}
