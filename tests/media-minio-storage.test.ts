import { CloudStorage } from "@share/middleware/upload/cloud-storage";
import { IUploadConfig } from "@share/middleware/upload/storage-interface";

describe("CloudStorage with an S3-compatible endpoint", () => {
  const uploadConfig: IUploadConfig = {
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg"],
    destination: "./uploads",
    cloudEnabled: true,
    cloudProvider: "minio",
    cloudBucket: "chatbe-media",
    cloudRegion: "us-east-1",
    cloudEndpoint: "http://minio:9000",
    cloudPublicEndpoint: "https://storage.example.com",
    cloudPublicBaseUrl: "https://storage.example.com/chatbe-media",
    cloudForcePathStyle: true,
    cloudAccessKeyId: "chatbe-test",
    cloudSecretAccessKey: "chatbe-test-secret",
  };

  it("builds permanent file URLs from the public endpoint", () => {
    const storage = new CloudStorage(
      uploadConfig,
      "chatbe-media",
      "us-east-1",
    );

    expect(storage.getFileUrl("image/user/file.jpg")).toBe(
      "https://storage.example.com/chatbe-media/image/user/file.jpg",
    );
  });

  it("signs browser uploads with the public hostname and path-style bucket", async () => {
    const storage = new CloudStorage(
      uploadConfig,
      "chatbe-media",
      "us-east-1",
    );

    const signedUrl = await storage.getPresignedUploadUrl(
      "image/user/file.jpg",
      "image/jpeg",
      300,
    );
    const parsed = new URL(signedUrl);

    expect(parsed.hostname).toBe("storage.example.com");
    expect(parsed.pathname).toBe("/chatbe-media/image/user/file.jpg");
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("300");
  });
});
