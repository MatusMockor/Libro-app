export function branchId(sessionIndex: number): string {
  return `b${String(sessionIndex)}`;
}

export function childId(hostId: string, prefix: string, index: number): string {
  return `${hostId}.${prefix}${String(index)}`;
}
