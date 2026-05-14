import { Router } from 'express';
import { CallController } from './call.controller';

let _controller: CallController;

export const getCallController = () => _controller;

export const setupCallRoutes = (controller: CallController, mdlFactory: any) => {
  _controller = controller;

  const router = Router();

  router.post('/calls/v2', mdlFactory.auth, controller.createCloudCall.bind(controller));
  router.post('/calls/v2/:callId/answer', mdlFactory.auth, controller.answerCloudCall.bind(controller));
  router.post('/calls/v2/:callId/reject', mdlFactory.auth, controller.rejectCall.bind(controller));
  router.post('/calls/v2/:callId/missed', mdlFactory.auth, controller.missedCall.bind(controller));
  router.delete('/calls/v2/:callId', mdlFactory.auth, controller.endCall.bind(controller));
  router.get('/calls/v2/:callId/token', mdlFactory.auth, controller.getCloudToken.bind(controller));

  router.post('/calls', mdlFactory.auth, controller.createCall.bind(controller));
  router.post('/calls/:callId/answer', mdlFactory.auth, controller.answerCall.bind(controller));
  router.post('/calls/:callId/reject', mdlFactory.auth, controller.rejectCall.bind(controller));
  router.post('/calls/:callId/missed', mdlFactory.auth, controller.missedCall.bind(controller));
  router.delete('/calls/:callId', mdlFactory.auth, controller.endCall.bind(controller));
  router.get('/calls/:callId/token', mdlFactory.auth, controller.getToken.bind(controller));

  return router;
};
