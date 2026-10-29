import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDENTITY_TOKEN_VERIFIER } from './identity-token-verifier.js';
import { GOOGLE_SIGNING_KEYS, googleSigningKeys } from './providers/google.provider.js';
import { oidcProviderConfigs } from './providers/oidc-provider-configs.js';
import { IdentityTokenVerifiers } from './security/identity-token-verifiers.js';
import { OIDC_PROVIDER_CONFIGS } from './security/oidc-provider-config.js';

@Module({
  providers: [
    { provide: GOOGLE_SIGNING_KEYS, useFactory: googleSigningKeys },
    {
      provide: OIDC_PROVIDER_CONFIGS,
      inject: [ConfigService, GOOGLE_SIGNING_KEYS],
      useFactory: oidcProviderConfigs,
    },
    IdentityTokenVerifiers,
    { provide: IDENTITY_TOKEN_VERIFIER, useExisting: IdentityTokenVerifiers },
  ],
  exports: [IDENTITY_TOKEN_VERIFIER],
})
export class IdentityProvidersModule {}
