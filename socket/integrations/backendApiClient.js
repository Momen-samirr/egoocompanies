function createBackendApiClient({ env, state }) {
  async function fetchCompanyDrivers(companyId) {
    if (!companyId) return [];

    if (state.companyDriversMap[companyId]) {
      return state.companyDriversMap[companyId];
    }

    try {
      const response = await fetch(
        `${env.serverUrl}/admin/companies/${companyId}/drivers`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.drivers) {
          const driverIds = data.drivers.map((driver) => driver.id);
          state.companyDriversMap[companyId] = driverIds;
          return driverIds;
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching company drivers for ${companyId}:`, error);
    }

    return [];
  }

  async function fetchTripCurrentLocation(tripId) {
    if (!tripId) return null;

    try {
      const response = await fetch(
        `${env.serverUrl}/internal/trips/${tripId}/current-location`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.location) {
          return data.location;
        }
      } else {
        console.error(
          `❌ Error fetching trip current location for ${tripId}: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error fetching trip current location for ${tripId}:`,
        error.message
      );
    }

    return null;
  }

  return {
    fetchCompanyDrivers,
    fetchTripCurrentLocation,
  };
}

module.exports = {
  createBackendApiClient,
};
