import { z } from 'zod';

const MAX_KEY_LENGTH = 200;

const MAX_QUERY_VALUE_LENGTH = 100;

function joinedPath(segments: unknown): unknown {
  return Array.isArray(segments) ? segments.join('/') : segments;
}

export const mediaFileParamsSchema = z.object({
  key: z
    .preprocess(joinedPath, z.string().max(MAX_KEY_LENGTH))
    .meta({ description: 'Storage key of the file, e.g. <mediaId>/small.webp' }),
});

export const mediaFileQuerySchema = z.object({
  expires: z
    .string()
    .max(MAX_QUERY_VALUE_LENGTH)
    .default('')
    .meta({ description: 'Unix time in seconds when the URL expires' }),
  signature: z
    .string()
    .max(MAX_QUERY_VALUE_LENGTH)
    .default('')
    .meta({ description: 'HMAC-SHA256 of the key and expiry, base64url' }),
});

export type MediaFileParams = z.infer<typeof mediaFileParamsSchema>;
export type MediaFileQuery = z.infer<typeof mediaFileQuerySchema>;
