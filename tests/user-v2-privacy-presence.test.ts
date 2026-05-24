import { FriendshipStatus } from "@modules/friendships/model/model";
import { UserInfoVisibility } from "@modules/user/model/model";
import {
  DEFAULT_USER_PRIVACY,
  RelationshipPrivacyPolicyV2,
} from "@modules/user/usecase/relationship-privacy-policy-v2";
import { PresenceUseCase } from "@modules/user/usecase/presence-usecase";

describe("user privacy and presence", () => {
  const makeUser = (id: string, privacy: Partial<typeof DEFAULT_USER_PRIVACY> = {}) => ({
    id,
    status: "active",
    displayName: id,
    phone: `+840000${id}`,
    avatarUrl: `https://cdn.test/${id}.png`,
    verified: { email: false, phone: false },
    privacy: {
      ...DEFAULT_USER_PRIVACY,
      ...privacy,
    },
    settings: { notifications: { push: true, inApp: true } },
    password: "x",
    salt: "x",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("hides presence when the viewer disables online visibility", async () => {
    const viewer = makeUser("viewer", { showOnline: false });
    const target = makeUser("target");
    const userRepo = {
      get: jest.fn(async (id: string) => (id === "viewer" ? viewer : target)),
    };
    const friendshipRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const blockRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const policy = new RelationshipPrivacyPolicyV2(userRepo, friendshipRepo, blockRepo);

    await expect(
      policy.applyPresenceVisibility("viewer", "target", {
        isOnline: true,
        lastSeen: 123,
      }),
    ).resolves.toEqual({
      userId: "target",
      visibility: "hidden",
      isOnline: false,
      lastSeen: null,
    });
  });

  it("does not leak private profile fields to non-friends", async () => {
    const target = makeUser("target", {
      phoneVisibility: UserInfoVisibility.FRIENDS,
      birthdayVisibility: UserInfoVisibility.ONLY_ME,
    }) as any;
    target.birthday = new Date("2000-01-01T00:00:00.000Z");
    const friendshipRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const blockRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const policy = new RelationshipPrivacyPolicyV2({}, friendshipRepo, blockRepo);

    const profile = await policy.sanitizePublicProfile("viewer", target);

    expect(profile.phone).toBeUndefined();
    expect(profile.birthday).toBeUndefined();
    expect(profile.avatarUrl).toBe(target.avatarUrl);
  });

  it("blocks stranger messages when receiver enables the setting", async () => {
    const receiver = makeUser("receiver", { blockMessagesFromStrangers: true });
    const userRepo = { get: jest.fn().mockResolvedValue(receiver) };
    const friendshipRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const blockRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const policy = new RelationshipPrivacyPolicyV2(userRepo, friendshipRepo, blockRepo);

    await expect(policy.canReceiveStrangerMessage("sender", "receiver")).resolves.toBe(false);
  });

  it("allows friend messages even when stranger messages are blocked", async () => {
    const receiver = makeUser("receiver", { blockMessagesFromStrangers: true });
    const userRepo = { get: jest.fn().mockResolvedValue(receiver) };
    const friendshipRepo = {
      findByCond: jest.fn().mockResolvedValue({ status: FriendshipStatus.ACTIVE }),
    };
    const blockRepo = { findByCond: jest.fn().mockResolvedValue(null) };
    const policy = new RelationshipPrivacyPolicyV2(userRepo, friendshipRepo, blockRepo);

    await expect(policy.canReceiveStrangerMessage("sender", "receiver")).resolves.toBe(true);
  });

  it("updates last seen only when the final socket unregisters", async () => {
    const repo = {
      setOnline: jest.fn(),
      setOffline: jest.fn(),
      registerSocket: jest.fn(),
      touchSocket: jest.fn(),
      unregisterSocket: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
      updateLastSeen: jest.fn(),
      isOnline: jest.fn(),
      getLastSeen: jest.fn(),
    };
    const presence = new PresenceUseCase(repo);

    await expect(presence.unregisterSocket("u1", "s1")).resolves.toEqual({
      becameOffline: false,
      connectionCount: 2,
    });
    expect(repo.updateLastSeen).not.toHaveBeenCalled();

    await expect(presence.unregisterSocket("u1", "s2")).resolves.toEqual({
      becameOffline: true,
      connectionCount: 0,
    });
    expect(repo.updateLastSeen).toHaveBeenCalledTimes(1);
  });
});
