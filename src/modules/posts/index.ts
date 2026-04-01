import { ServiceContext } from "@share/interface/service-context";
import { Router } from "express";
import { MongoPostRepository, MongoPostReactionRepository, MongoPostCommentRepository } from "./infras/repository";
import { PostUseCase } from "./usecase";
import { PostHTTPService } from "./infras/transport";
import { MongoFriendshipRepository } from "@modules/friendships/infras/repository/nosql/mongodb-repo";

export * from "./model";
export * from "./interface";

export const setupPostHexagon = (sctx: ServiceContext) => {
  const postRepo = new MongoPostRepository();
  const reactionRepo = new MongoPostReactionRepository();
  const commentRepo = new MongoPostCommentRepository();
  const friendshipRepo = new MongoFriendshipRepository();
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
