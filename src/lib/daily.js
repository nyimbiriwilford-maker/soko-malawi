export async function createCallRoom(roomName) {
  return `https://meet.jit.si/soko-${roomName}`
}

export function generateRoomName(userId1, userId2, contextId) {
  const sorted = [userId1, userId2].sort()
  return sorted[0].slice(0, 8) + sorted[1].slice(0, 8) + contextId.slice(0, 6)
}