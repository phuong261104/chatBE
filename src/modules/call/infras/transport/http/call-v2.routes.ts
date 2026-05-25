import { Router } from 'express';
import { MdlFactory } from '@share/interface/service-context';
import { CallV2Controller } from './call-v2.controller';

export const setupCallV2Routes = (controller: CallV2Controller, mdlFactory: MdlFactory) => {
  const router = Router();

  router.post('/calls', mdlFactory.auth, controller.createCall.bind(controller));
  router.get(
    '/calls/conversations/:conversationId/active',
    mdlFactory.auth,
    controller.getActiveByConversation.bind(controller),
  );
  router.get(
    '/calls/active-by-conversation/:conversationId',
    mdlFactory.auth,
    controller.getActiveByConversation.bind(controller),
  );
  router.post('/calls/:callId/join', mdlFactory.auth, controller.joinCall.bind(controller));
  router.post('/calls/:callId/leave', mdlFactory.auth, controller.leaveCall.bind(controller));
  router.post('/calls/:callId/reject', mdlFactory.auth, controller.rejectCall.bind(controller));
  router.post('/calls/:callId/missed', mdlFactory.auth, controller.missedCall.bind(controller));
  router.post('/calls/:callId/end', mdlFactory.auth, controller.endCall.bind(controller));
  router.delete('/calls/:callId', mdlFactory.auth, controller.endCall.bind(controller));
  router.get('/calls/:callId/token', mdlFactory.auth, controller.getToken.bind(controller));

  return router;
};
