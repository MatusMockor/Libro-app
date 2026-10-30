import { SHARED_WITH_FOLLOWERS } from '../domain/live-session-sharing.js';

export function currentParticipantsFrom(hostSessionId: string, alias = 'current'): string {
  return `
    FROM reading.session_participants AS ${alias}_participation
    JOIN reading.sessions AS ${alias}_member
      ON ${alias}_member.id = ${alias}_participation.participant_session_id
    JOIN reading.sessions AS ${alias}_host
      ON ${alias}_host.id = ${alias}_participation.host_session_id
    WHERE ${alias}_participation.host_session_id = ${hostSessionId}
      AND ${alias}_participation.left_at IS NULL
      AND ${alias}_participation.removed_at IS NULL
      AND ${alias}_member.status <> 'ended'
      AND ${alias}_host.status <> 'ended'
  `;
}

export function currentGroupRootOf(session: string): string {
  return `coalesce(
    (SELECT root_membership.host_session_id
     FROM reading.session_participants AS root_membership
     JOIN reading.sessions AS root_host ON root_host.id = root_membership.host_session_id
     WHERE root_membership.participant_session_id = ${session}.id
       AND root_membership.left_at IS NULL
       AND root_membership.removed_at IS NULL
       AND root_host.status <> 'ended'
       AND ${session}.status <> 'ended'),
    (SELECT ${session}.id
     WHERE ${session}.status <> 'ended'
       AND EXISTS (SELECT 1 ${currentParticipantsFrom(`${session}.id`)}))
  )`;
}

export const VIEWER_GROUP = `
  viewer_group AS (
    SELECT ${currentGroupRootOf('viewer_session')} AS root
    FROM reading.sessions AS viewer_session
    WHERE viewer_session.user_id = $1 AND viewer_session.status <> 'ended'
  )
`;

export function audienceOf(session: string): string {
  return `(
    ${session}.user_id = $1
    OR (
      ${session}.user_id = ANY ($2::uuid[])
      AND coalesce(
        (SELECT owner_setting.live_sessions
         FROM reading.sharing_settings AS owner_setting
         WHERE owner_setting.user_id = ${session}.user_id),
        '${SHARED_WITH_FOLLOWERS}'
      ) = '${SHARED_WITH_FOLLOWERS}'
    )
    OR EXISTS (
      SELECT 1 FROM viewer_group WHERE viewer_group.root = ${currentGroupRootOf(session)}
    )
  )`;
}

export function visibleTo(session: string): string {
  return `(${session}.user_id = $1 OR (${session}.status <> 'ended' AND ${audienceOf(session)}))`;
}

export function visibleParticipantCountOf(hostSessionId: string): string {
  return `(
    SELECT count(*)::int
    ${currentParticipantsFrom(hostSessionId, 'counted')}
      AND ${visibleTo('counted_member')}
  )`;
}

export function latestCheckpointPageOf(session: string): string {
  return `(
    SELECT latest_checkpoint.page
    FROM reading.checkpoints AS latest_checkpoint
    WHERE latest_checkpoint.session_id = ${session}.id
    ORDER BY latest_checkpoint.recorded_at DESC, latest_checkpoint.id DESC
    LIMIT 1
  )`;
}
