import { File, UploadType } from 'expo-file-system';

/**
 * R3-4: send a local file's bytes with Expo's native uploader (expo-file-system `File.upload`,
 * BINARY_CONTENT). React Native Android can't reliably `fetch(file).blob()` then PUT the blob
 * (the bytes never arrived on the founder's phone), so every photo/video upload goes through here.
 */
export interface NativeUploadOptions {
  method: 'PUT' | 'POST' | 'PATCH';
  headers: Record<string, string>;
  mime: string;
  /** 0..1 as the bytes go out. */
  onProgress?: (fraction: number) => void;
}

export interface NativeUploadResult {
  status: number;
  body: string;
}

export interface NativeUploader {
  size(uri: string): number | null;
  upload(uri: string, url: string, opts: NativeUploadOptions): Promise<NativeUploadResult>;
}

export const nativeUploader: NativeUploader = {
  size(uri) {
    try {
      const s = new File(uri).size;
      return typeof s === 'number' && s > 0 ? s : null;
    } catch {
      return null;
    }
  },
  async upload(uri, url, { method, headers, mime, onProgress }) {
    const r = await new File(uri).upload(url, {
      httpMethod: method,
      uploadType: UploadType.BINARY_CONTENT,
      headers,
      mimeType: mime,
      onProgress: onProgress ? (p) => onProgress(p.totalBytes > 0 ? Math.min(1, p.bytesSent / p.totalBytes) : 0) : undefined,
    });
    return { status: r.status, body: r.body };
  },
};
