let socketServer;
export const setIO = (io) => {
  socketServer = io;
};
export const getIO = () => socketServer;
export function emitCharger(charger) {
  socketServer?.to(`station:${charger.stationId}`).emit("charger_status_update", {
    stationId: charger.stationId,
    chargerId: charger.id,
    status: charger.status,
    updatedAt: new Date().toISOString()
  });
}
export function emitSession(session, stationId, chargerId) {
  const payload = {
    sessionId: session.id,
    stationId,
    chargerId,
    userId: session.userId,
    status: session.status,
    energyDeliveredKwh: Number(session.energyDeliveredKwh),
    batteryPercent: session.endBatteryPercent ?? session.startBatteryPercent,
    powerKw: Number(session.averagePowerKw || 0),
    totalCost: session.totalCost == null ? null : Number(session.totalCost)
  };
  socketServer
    ?.to(`session:${session.id}`)
    .to(`station:${stationId}`)
    .to(`operator:${stationId}`)
    .emit("session_update", payload);
}
