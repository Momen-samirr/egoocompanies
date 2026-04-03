function createRuntimeState() {
  return {
    drivers: {},
    activeRides: {},
    userConnections: {},
    activeTripsMap: {},
    companyDriversMap: {},
  };
}

module.exports = {
  createRuntimeState,
};
