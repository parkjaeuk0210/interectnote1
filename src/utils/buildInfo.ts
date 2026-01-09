export interface BuildInfo {
  sha: string;
  ref: string;
  time: string;
  shortSha: string;
}

const buildSha = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : ''
const buildRef = typeof __BUILD_REF__ === 'string' ? __BUILD_REF__ : ''
const buildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

export const BUILD_INFO: BuildInfo = {
  sha: buildSha || 'dev',
  ref: buildRef || '',
  time: buildTime || '',
  shortSha: (buildSha || 'dev').slice(0, 7),
};

export function formatBuildLabel(): string {
  return `v${BUILD_INFO.shortSha || 'dev'}`;
}

export function formatBuildTooltip(): string {
  const parts: string[] = [];
  parts.push(formatBuildLabel());
  if (BUILD_INFO.time) parts.push(BUILD_INFO.time);
  if (BUILD_INFO.ref) parts.push(BUILD_INFO.ref);
  return parts.join(' · ');
}
