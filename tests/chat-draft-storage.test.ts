const mockDocumentSend = jest.fn();

jest.mock("@share/repository/dynamodb/client", () => ({
  getDocClient: () => ({ send: mockDocumentSend }),
  getDynamoDBClient: () => ({ send: jest.fn() }),
  getTableName: (tableName: string) => `test_${tableName}`,
}));

import { DeleteDraftCommandHandler } from "@modules/chat/usecase/delete-draft";
import { GetDraftsQueryHandler } from "@modules/chat/usecase/get-drafts";
import { SaveDraftCommandHandler } from "@modules/chat/usecase/save-draft";

describe("chat draft DynamoDB storage", () => {
  const membershipRepo = {
    findByCond: jest.fn().mockResolvedValue({ id: "member-1" }),
  };

  beforeEach(() => {
    mockDocumentSend.mockReset();
    membershipRepo.findByCond.mockReset();
    membershipRepo.findByCond.mockResolvedValue({ id: "member-1" });
  });

  it("uses the prefixed drafts table for save, query, and delete", async () => {
    mockDocumentSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({});

    await new SaveDraftCommandHandler(membershipRepo as any).execute({
      conversationId: "019fae31-b464-7112-a88e-7dc25862f152",
      userId: "019fae31-b74e-7112-a88f-17d78eb6c369",
      text: "draft",
      media: [],
    });
    await new GetDraftsQueryHandler(membershipRepo as any).query({
      conversationId: "019fae31-b464-7112-a88e-7dc25862f152",
      userId: "019fae31-b74e-7112-a88f-17d78eb6c369",
    });
    await new DeleteDraftCommandHandler(membershipRepo as any).execute({
      conversationId: "019fae31-b464-7112-a88e-7dc25862f152",
      userId: "019fae31-b74e-7112-a88f-17d78eb6c369",
    });

    expect(mockDocumentSend).toHaveBeenCalledTimes(3);
    for (const [command] of mockDocumentSend.mock.calls) {
      expect(command.input.TableName).toBe("test_drafts");
    }
  });
});
