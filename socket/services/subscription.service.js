function createSubscriptionService({
  subscriptionsState,
  connectionManager,
  broadcastService,
  backendApiClient,
}) {
  function subscribeAdminToTrip(connectionId, tripId) {
    if (!tripId || !connectionId) return false;
    if (!subscriptionsState.adminTripSubscriptions.has(connectionId)) {
      subscriptionsState.adminTripSubscriptions.set(connectionId, new Set());
    }
    subscriptionsState.adminTripSubscriptions.get(connectionId).add(tripId);
    return true;
  }

  function unsubscribeAdminFromTrip(connectionId, tripId) {
    if (!tripId || !connectionId) return false;
    if (!subscriptionsState.adminTripSubscriptions.has(connectionId)) {
      return false;
    }
    subscriptionsState.adminTripSubscriptions.get(connectionId).delete(tripId);
    return true;
  }

  async function subscribeParentToTrip(connectionId, payload) {
    const { tripId, studentId, parentId } = payload;
    if (!tripId || !studentId || !parentId || !connectionId) return null;

    if (!subscriptionsState.parentTripSubscriptions.has(connectionId)) {
      subscriptionsState.parentTripSubscriptions.set(connectionId, new Set());
    }

    const subscription = JSON.stringify({ tripId, studentId, parentId });
    subscriptionsState.parentTripSubscriptions.get(connectionId).add(subscription);

    const currentLocation = await backendApiClient.fetchTripCurrentLocation(tripId);
    if (!currentLocation || !currentLocation.location) return null;

    return {
      type: "tripLocationUpdate",
      tripId,
      studentId,
      driverId: currentLocation.driverId,
      location: currentLocation.location,
      speed: currentLocation.speed || 0,
      deviationStatus: currentLocation.deviationStatus || {
        isDeviated: false,
        distance: 0,
      },
      eta: currentLocation.eta || null,
      timestamp: currentLocation.timestamp || new Date().toISOString(),
    };
  }

  function unsubscribeParentFromTrip(connectionId, tripId) {
    if (!tripId || !connectionId) return false;
    if (!subscriptionsState.parentTripSubscriptions.has(connectionId)) return false;

    const subscriptions = subscriptionsState.parentTripSubscriptions.get(connectionId);
    const toRemove = [];
    subscriptions.forEach((sub) => {
      const parsed = JSON.parse(sub);
      if (parsed.tripId === tripId) {
        toRemove.push(sub);
      }
    });
    toRemove.forEach((sub) => subscriptions.delete(sub));
    return true;
  }

  function cleanupConnectionSubscriptions(connectionId) {
    subscriptionsState.adminTripSubscriptions.delete(connectionId);
    subscriptionsState.parentTripSubscriptions.delete(connectionId);
  }

  function broadcastTripLocation(tripId, locationData) {
    broadcastService.broadcastTripLocationUpdate(tripId, locationData);
    broadcastService.broadcastTripLocationToParents(tripId, locationData);
  }

  function getParentSubscriptionCount() {
    return subscriptionsState.parentTripSubscriptions.size;
  }

  return {
    subscribeAdminToTrip,
    unsubscribeAdminFromTrip,
    subscribeParentToTrip,
    unsubscribeParentFromTrip,
    cleanupConnectionSubscriptions,
    broadcastTripLocation,
    getParentSubscriptionCount,
  };
}

module.exports = {
  createSubscriptionService,
};
