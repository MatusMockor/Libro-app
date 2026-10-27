import { z } from 'zod';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const fieldErrorSchema = z.object({
  path: z.string().meta({
    description: 'Dot-separated path of the invalid field, empty when the whole input is invalid',
  }),
  message: z.string(),
  code: z.string(),
});

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    code: z.string().meta({
      description: 'Stable machine-readable error code, clients branch on this field',
    }),
    errors: z.array(fieldErrorSchema).optional(),
  })
  .meta({
    description: 'RFC 9457 Problem Details',
    example: {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'The request contains invalid fields.',
      instance: '/v1/books',
      code: 'validation_failed',
      errors: [
        { path: 'pages', message: 'Too small: expected number to be >0', code: 'too_small' },
      ],
    },
  });

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
