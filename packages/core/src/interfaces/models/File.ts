// Image variant structure returned by the API
export interface FileImageVariant {
  path: string;           // Relative storage path
  publicPath: string;     // Proxy URL added by transformFileForResponse
  width: number;
  height: number;
  size: number;           // Bytes
  format: string;         // webp, jpeg, png
}

// Image extension data (populated for type: "image" files)
export interface FileImage {
  fileId: string;
  originalWidth: number;
  originalHeight: number;
  variants: Record<string, FileImageVariant>;  // thumbnail, small, medium, large, etc.
  processingStatus: "completed" | "failed";
  processingError: string | null;
  format: string;         // User-requested format
  quality: number;        // User-requested quality (1-100)
  exifStripped: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface File {
  id: string;
  projectId: string;
  userId: string | null;
  entityId: string | null;
  commentId: string | null;
  chatMessageId: string | null;
  spaceId: string | null;

  type: "image" | "video" | "document" | "other";
  originalPath: string;   // Proxied URL after transformFileForResponse
  originalSize: number;
  originalMimeType: string;
  position: number;

  metadata: Record<string, any>;
  image?: FileImage;      // Optional - only for type: "image"
  createdAt: string;
  updatedAt: string;
}
