import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { DynamoPostRepository, DynamoPostReactionRepository, DynamoPostCommentRepository } from "./infras/repository/dynamodb";
import { PostUseCase } from "./usecase";
import { PostHTTPService } from "./infras/transport";
import { DynamoFriendshipRepository } from "@modules/friendships/infras/repository/dynamodb";

export * from "./model";
export * from "./interface";

export const setupPostHexagon = (sctx: ServiceContext) => {
  const postRepo = new DynamoPostRepository();
  const reactionRepo = new DynamoPostReactionRepository();
  const commentRepo = new DynamoPostCommentRepository();
  const friendshipRepo = new DynamoFriendshipRepository();
  const useCase = new PostUseCase(postRepo, reactionRepo, commentRepo, friendshipRepo);
  const httpService = new PostHTTPService(useCase);

  const router = Router();
  const mdl = sctx.mdlFactory;

  router.post("/posts", mdl.auth, httpService.createPostAPI.bind(httpService));
  router.get("/posts", mdl.auth, httpService.getFeedAPI.bind(httpService));
  router.get("/posts/:id", mdl.auth, httpService.getPostByIdAPI.bind(httpService));
  router.delete("/posts/:id", mdl.auth, httpService.deletePostAPI.bind(httpService));
  router.post("/posts/:id/react", mdl.auth, httpService.reactPostAPI.bind(httpService));
  router.get("/posts/:id/comments", mdl.auth, httpService.getCommentsAPI.bind(httpService));
  router.post("/posts/:id/comments", mdl.auth, httpService.addCommentAPI.bind(httpService));
  router.delete("/posts/:id/comments/:commentId", mdl.auth, httpService.deleteCommentAPI.bind(httpService));
  router.post("/posts/:id/share", mdl.auth, httpService.sharePostAPI.bind(httpService));

  return router;
};
