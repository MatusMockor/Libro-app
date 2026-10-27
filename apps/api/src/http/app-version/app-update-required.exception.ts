import { ProblemException } from '../problem-details/problem.exception.js';
import type { AppVersion } from '../../shared/app-version.js';

const UPGRADE_REQUIRED = 426;

export class AppUpdateRequiredException extends ProblemException {
  constructor(minimum: AppVersion) {
    super({
      status: UPGRADE_REQUIRED,
      code: 'app_update_required',
      detail: `This app version is no longer supported. Update to ${minimum.toString()} or newer.`,
    });
  }
}
