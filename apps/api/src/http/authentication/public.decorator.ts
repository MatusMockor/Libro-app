import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');

export const Public = () => applyDecorators(SetMetadata(PUBLIC_ROUTE, true), ApiSecurity({}));
