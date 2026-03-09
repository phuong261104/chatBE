import { model } from "mongoose";
import { Paginated, PagingDTO } from "@share/model/paging";
import { Response } from "express";

export const generateRandomString = (length: number): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let result = "";
  const randomBuffer = new Uint32Array(length);

  crypto.getRandomValues(randomBuffer);

  for (let i = 0; i < length; i++) {
    result += characters[randomBuffer[i] % charactersLength];
  }

  return result;
};

const successResponse = (data: any, res: Response) => {
  res.status(200).json({ data });
};

const pagingResponse = (
  data: any,
  paging: PagingDTO,
  filter: any,
  res: Response,
) => {
  res.status(200).json({ data, paging, filter });
};

const paginatedResponse = (
  paginated: Paginated<any>,
  filter: any,
  res: Response,
) => {
  res.status(200).json({
    data: paginated.data,
    paging: paginated.paging,
    total: paginated.total,
    filter,
  });
};

export { paginatedResponse, pagingResponse, successResponse };
