import multer from "multer";
import { v7 } from "uuid";
import { AppError } from "@share/app-error";
import {
  IPresignedStorageStrategy,
  StoredObjectMetadata,
} from "@share/middleware/upload/storage-interface";
import {
  MediaFileType,
  UploadStatus,
  uploadRegistry,
} from "@modules/media/model/dto";
import { ConfirmUploadCmdHandler } from "@modules/media/usecase/confirm-upload";

class FakePresignedStorage implements IPresignedStorageStrategy {
  metadata: StoredObjectMetadata = {
    size: 123,
    contentType: "image/jpeg",
  };
  metadataError?: Error;
  deletedKeys: string[] = [];

  getStorage(): multer.StorageEngine {
    return multer.memoryStorage();
  }

  getBaseUrl(): string {
    return "https://storage.example.com/chatbe-media";
  }

  getFileUrl(filename: string): string {
    return `${this.getBaseUrl()}/${filename}`;
  }

  async deleteFile(filePath: string): Promise<void> {
    this.deletedKeys.push(filePath);
  }

  isMimeTypeAllowed(): boolean {
    return true;
  }

  async getPresignedUploadUrl(): Promise<string> {
    return "https://storage.example.com/signed-put";
  }

  async getPresignedUrl(): Promise<string> {
    return "https://storage.example.com/signed-get";
  }

  async getObjectMetadata(): Promise<StoredObjectMetadata> {
    if (this.metadataError) {
      throw this.metadataError;
    }
    return this.metadata;
  }
}

function registerPendingUpload(fileId: string): void {
  uploadRegistry.set(
    fileId,
    {
      fileId,
      filename: `image/user-1/${fileId}.jpg`,
      url: `https://storage.example.com/chatbe-media/image/user-1/${fileId}.jpg`,
      mimeType: "image/jpeg",
      fileSize: 123,
      fileType: MediaFileType.IMAGE,
      originalName: "photo.jpg",
      expiresAt: new Date(Date.now() + 60_000),
      status: UploadStatus.PENDING,
      userId: "user-1",
    } as any,
  );
}

describe("ConfirmUploadCmdHandler", () => {
  it("confirms a real object and ignores a client-supplied URL", async () => {
    const storage = new FakePresignedStorage();
    const handler = new ConfirmUploadCmdHandler(storage);
    const fileId = v7();
    registerPendingUpload(fileId);

    const result = await handler.execute({
      userId: "user-1",
      data: {
        fileId,
        uploadedUrl: "https://attacker.example/file.jpg",
      },
    });

    expect(result.url).toContain("storage.example.com/chatbe-media");
    expect(result.url).not.toContain("attacker.example");
  });

  it("rejects and removes an object whose metadata does not match", async () => {
    const storage = new FakePresignedStorage();
    storage.metadata = { size: 999, contentType: "image/jpeg" };
    const handler = new ConfirmUploadCmdHandler(storage);
    const fileId = v7();
    registerPendingUpload(fileId);

    await expect(
      handler.execute({ userId: "user-1", data: { fileId } }),
    ).rejects.toMatchObject({
      message: "Uploaded object metadata does not match the request",
    });
    expect(storage.deletedKeys).toEqual([
      `image/user-1/${fileId}.jpg`,
    ]);
  });

  it("returns a conflict when the object has not been uploaded", async () => {
    const storage = new FakePresignedStorage();
    const notFound = new Error("Not found");
    notFound.name = "NotFound";
    storage.metadataError = notFound;
    const handler = new ConfirmUploadCmdHandler(storage);
    const fileId = v7();
    registerPendingUpload(fileId);

    try {
      await handler.execute({ userId: "user-1", data: { fileId } });
      throw new Error("Expected confirm to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).getStatusCode()).toBe(409);
    }
  });
});
