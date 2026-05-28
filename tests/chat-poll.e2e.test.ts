import { PollStatus } from "@modules/chat/model";
import { bearer, socketToken } from "./helpers/chat-e2e-socket";
import { createChatE2EHarness, ChatE2EHarness, authHeader } from "./helpers/chat-e2e-harness";
import { seedGroupConversation } from "./helpers/chat-e2e-seeds";

describe("chat poll E2E", () => {
  let harness: ChatE2EHarness;

  beforeEach(async () => {
    harness = await createChatE2EHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  describe("create poll", () => {
    it("creates a poll successfully", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls`,
        {
          question: "Chọn ngày họp?",
          options: ["Thứ 2", "Thứ 3", "Thứ 4"],
        },
        { headers: authHeader(owner.id) },
      );

      expect(response.status).toBe(201);
      expect(response.data.data.question).toBe("Chọn ngày họp?");
      expect(response.data.data.options).toHaveLength(3);
      expect(response.data.data.status).toBe(PollStatus.ACTIVE);
      expect(response.data.data.totalVotes).toBe(0);
      expect(response.data.data.allowChangeVote).toBe(false);
    });

    it("creates a poll with all options", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls`,
        {
          question: "Họp ngày nào?",
          options: ["Thứ 2", "Thứ 3"],
          isMultipleChoice: true,
          allowAddOption: true,
          allowChangeVote: true,
          showResultsBeforeClose: true,
          hideVoters: false,
        },
        { headers: authHeader(owner.id) },
      );

      expect(response.status).toBe(201);
      expect(response.data.data.isMultipleChoice).toBe(true);
      expect(response.data.data.allowAddOption).toBe(true);
      expect(response.data.data.allowChangeVote).toBe(true);
      expect(response.data.data.showResultsBeforeClose).toBe(true);
      expect(response.data.data.hideVoters).toBe(false);
    });

    it("returns 400 for poll with less than 2 options", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls`,
        {
          question: "Only one option?",
          options: ["Thứ 2"],
        },
        { headers: authHeader(owner.id) },
      );

      expect(response.status).toBe(400);
    });

    it("returns 403 for non-member trying to create poll", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const outsider = harness.store.addUser({ displayName: "Outsider" });

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls`,
        {
          question: "Test?",
          options: ["A", "B"],
        },
        { headers: authHeader(outsider.id) },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("get polls", () => {
    it("returns empty list when no polls exist", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(0);
      expect(response.data.meta?.hasMore).toBe(false);
    });

    it("lists all polls in a group", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      await harness.useCase.createPoll(conversation.id, owner.id, "Poll 1", ["A", "B"]);
      await harness.useCase.createPoll(conversation.id, owner.id, "Poll 2", ["A", "B"]);

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data).toHaveLength(2);
      const questions = response.data.data.map((p: any) => p.question).sort();
      expect(questions).toEqual(["Poll 1", "Poll 2"]);
    });

    it("returns 403 for non-member", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const outsider = harness.store.addUser({ displayName: "Outsider" });

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls`, {
        headers: authHeader(outsider.id),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("get single poll", () => {
    it("returns a single poll by id", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Single Poll?", ["A", "B"]);

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.question).toBe("Single Poll?");
      expect(response.data.data.id).toBe(poll.id);
    });

    it("returns 404 for non-existent poll", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls/non-existent-id`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("vote poll", () => {
    it("votes on a single-choice poll", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Single choice?", ["A", "B"]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[0].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(200);
      expect(response.data.data.options[0].voteCount).toBe(1);
      expect(response.data.data.options[1].voteCount).toBe(0);
    });

    it("changes vote on single-choice poll when allowChangeVote is true", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(
        conversation.id,
        owner.id,
        "Single choice?",
        ["A", "B"],
        false,
        false,
        true,
      );

      await harness.useCase.votePoll(poll.id, member.id, [poll.options[0].id]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[1].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(200);
      expect(response.data.data.options[0].voteCount).toBe(0);
      expect(response.data.data.options[1].voteCount).toBe(1);
    });

    it("rejects vote change when allowChangeVote is false", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Locked choice?", ["A", "B"]);

      await harness.useCase.votePoll(poll.id, member.id, [poll.options[0].id]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[1].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(400);
      expect(response.data.msg).toContain("change your vote");
    });

    it("votes on a multi-choice poll", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(
        conversation.id,
        owner.id,
        "Multi choice?",
        ["A", "B", "C"],
        true,
      );

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[0].id, poll.options[1].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(200);
      expect(response.data.data.options[0].voteCount).toBe(1);
      expect(response.data.data.options[1].voteCount).toBe(1);
      expect(response.data.data.options[2].voteCount).toBe(0);
      expect(response.data.data.totalVotes).toBe(1);
    });

    it("toggles off a multi-choice option", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(
        conversation.id,
        owner.id,
        "Multi toggle?",
        ["A", "B"],
        true,
        false,
        true,
      );

      await harness.useCase.votePoll(poll.id, member.id, [poll.options[0].id, poll.options[1].id]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[0].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(200);
      expect(response.data.data.options[0].voteCount).toBe(1);
      expect(response.data.data.options[1].voteCount).toBe(0);
    });

    it("rejects more than one option on single-choice poll", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Single?", ["A", "B"]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[0].id, poll.options[1].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(400);
    });

    it("rejects vote on invalid option", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Invalid option?", ["A", "B"]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: ["invalid-option-id"] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("add poll option", () => {
    it("adds an option to an active poll with allowAddOption=true", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Add option?", ["A", "B"], false, true);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/options`,
        { text: "Option C" },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(200);
      expect(response.data.data.options).toHaveLength(3);
      expect(response.data.data.options[2].text).toBe("Option C");
      expect(response.data.data.options[2].voteCount).toBe(0);
      expect(response.data.data.options[2].addedBy).toBe(member.id);
    });

    it("rejects adding option when allowAddOption is false", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Cannot add?", ["A", "B"]);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/options`,
        { text: "Option C" },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("close poll", () => {
    it("closes an active poll by creator", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Will close?", ["A", "B"]);

      const response = await harness.api.post(`/v1/groups/${conversation.id}/polls/${poll.id}/lock`, undefined, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.status).toBe(PollStatus.CLOSED);
      expect(response.data.data.closedAt).toBeDefined();
    });

    it("closes an active poll by admin", async () => {
      const { owner, admin, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Admin closes?", ["A", "B"]);

      const response = await harness.api.post(`/v1/groups/${conversation.id}/polls/${poll.id}/lock`, undefined, {
        headers: authHeader(admin.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.status).toBe(PollStatus.CLOSED);
    });

    it("rejects voting on a closed poll", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Will close?", ["A", "B"]);
      await harness.useCase.closePoll(poll.id, owner.id);

      const response = await harness.api.post(
        `/v1/groups/${conversation.id}/polls/${poll.id}/vote`,
        { optionIds: [poll.options[0].id] },
        { headers: authHeader(member.id) },
      );

      expect(response.status).toBe(400);
      expect(response.data.msg).toContain("closed");
    });

    it("rejects close by regular member", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Member cannot close?", ["A", "B"]);

      const response = await harness.api.post(`/v1/groups/${conversation.id}/polls/${poll.id}/lock`, undefined, {
        headers: authHeader(member.id),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("pin / unpin poll", () => {
    it("pins a poll by owner", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Will pin?", ["A", "B"]);

      const response = await harness.api.post(`/v1/groups/${conversation.id}/polls/${poll.id}/pin`, undefined, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.pinned).toBe(true);
      expect(response.data.data.pinnedAt).toBeDefined();
    });

    it("unpins a poll by owner", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Will unpin?", ["A", "B"]);
      await harness.useCase.pinPoll(poll.id, owner.id);

      const response = await harness.api.delete(`/v1/groups/${conversation.id}/polls/${poll.id}/pin`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.pinned).toBe(false);
    });

    it("regular member cannot pin", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Member cannot pin?", ["A", "B"]);

      const response = await harness.api.post(`/v1/groups/${conversation.id}/polls/${poll.id}/pin`, undefined, {
        headers: authHeader(member.id),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("delete poll", () => {
    it("deletes a poll by creator", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Will delete?", ["A", "B"]);

      const response = await harness.api.delete(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.pollId).toBe(poll.id);

      const getResponse = await harness.api.get(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(owner.id),
      });
      expect(getResponse.status).toBe(404);
    });

    it("deletes a poll by admin", async () => {
      const { owner, admin, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Admin deletes?", ["A", "B"]);

      const response = await harness.api.delete(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(admin.id),
      });

      expect(response.status).toBe(200);
    });

    it("regular member cannot delete poll", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Member cannot delete?", ["A", "B"]);

      const response = await harness.api.delete(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(member.id),
      });

      expect(response.status).toBe(403);
    });

    it("returns 404 for non-existent poll", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);

      const response = await harness.api.delete(`/v1/groups/${conversation.id}/polls/non-existent-id`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(404);
    });

    it("unpins message when deleting pinned poll", async () => {
      const { owner, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Delete pinned?", ["A", "B"]);
      await harness.useCase.pinPoll(poll.id, owner.id);

      const pollMsg = harness.store.getMessage(poll.messageId!);
      expect(pollMsg?.pinned).toBe(true);

      await harness.api.delete(`/v1/groups/${conversation.id}/polls/${poll.id}`, {
        headers: authHeader(owner.id),
      });

      const afterMsg = harness.store.getMessage(poll.messageId!);
      expect(afterMsg?.pinned).toBe(false);
    });
  });

  describe("get poll results", () => {
    it("returns poll results with totalVotes and percentages", async () => {
      const { owner, member, conversation } = seedGroupConversation(harness.store);
      const poll = await harness.useCase.createPoll(conversation.id, owner.id, "Results test?", ["A", "B"]);
      await harness.useCase.votePoll(poll.id, member.id, [poll.options[0].id]);

      const response = await harness.api.get(`/v1/groups/${conversation.id}/polls/${poll.id}/results`, {
        headers: authHeader(owner.id),
      });

      expect(response.status).toBe(200);
      expect(response.data.data.totalVotes).toBe(1);
      expect(response.data.data.options[0].voteCount).toBe(1);
      expect(response.data.data.options[1].voteCount).toBe(0);
    });
  });
});
