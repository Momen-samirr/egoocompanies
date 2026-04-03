function createSubscriptionsState() {
  return {
    adminTripSubscriptions: new Map(),
    parentTripSubscriptions: new Map(),
  };
}

module.exports = {
  createSubscriptionsState,
};
