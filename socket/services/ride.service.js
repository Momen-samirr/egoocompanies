function createRideService({ state, broadcastService }) {
  function upsertRideStatus(data) {
    const { rideId, status, pickup, destination } = data;
    if (status === "In Progress" || status === "Accepted") {
      state.activeRides[rideId] = {
        id: rideId,
        status,
        pickup,
        destination,
        driverId: data.driverId,
        userId: data.userId,
        timestamp: new Date().toISOString(),
      };
    } else {
      delete state.activeRides[rideId];
    }

    broadcastService.broadcastToAdmins({
      type: "activeRidesUpdate",
      rides: state.activeRides,
    });
  }

  return {
    upsertRideStatus,
  };
}

module.exports = {
  createRideService,
};
