import axios from "axios";
import { getServerUri } from "@/configs/constants";

interface ActivateTripParams {
  accessToken: string;
  tripId: string;
  driverId: string;
  latitude: number;
  longitude: number;
}

export const activateTrip = async ({
  accessToken,
  tripId,
  driverId,
  latitude,
  longitude,
}: ActivateTripParams) => {
  if (!tripId) {
    throw new Error("Trip ID is required");
  }

  if (!driverId) {
    throw new Error("Driver ID is required");
  }

  return axios.post(
    `${getServerUri()}/driver/start-trip/${tripId}`,
    {
      driverId,
      latitude,
      longitude,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
};
