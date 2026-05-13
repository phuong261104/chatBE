import { Router, Request, Response, NextFunction } from 'express';
import { CallController } from '../controller/call.controller';

let _controller: CallController;

export const getCallController = () => _controller;

export const setupCallRoutes = (controller: CallController, mdlFactory: any) => {
  _controller = controller;

  const router = Router();

  router.post('/calls', mdlFactory.auth, controller.createCall.bind(controller));
  router.post('/calls/:callId/answer', mdlFactory.auth, controller.answerCall.bind(controller));
  router.post('/calls/:callId/reject', mdlFactory.auth, controller.rejectCall.bind(controller));
  router.post('/calls/:callId/missed', mdlFactory.auth, controller.missedCall.bind(controller));
  router.delete('/calls/:callId', mdlFactory.auth, controller.endCall.bind(controller));
  router.get('/calls/:callId/token', mdlFactory.auth, controller.getToken.bind(controller));

  return router;
};
