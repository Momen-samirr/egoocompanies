import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useEffect, useState } from "react";
import { getServerUri } from "@/configs/constants";

export const useGetDriverData = () => {
  const [driver, setDriver] = useState<DriverType>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create AbortController for request cancellation
    const abortController = new AbortController();

    const getLoggedInDriverData = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        const res = await axios.get(`${getServerUri()}/driver/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal, // Add signal for cancellation
        });

        // Only update state if request wasn't cancelled
        if (!abortController.signal.aborted) {
          setDriver(res.data.driver);
          setLoading(false);
        }
      } catch (error: any) {
        // Don't update state if request was cancelled
        if (axios.isCancel(error) || error.name === "AbortError") {
          console.log("Request cancelled");
          return;
        }
        console.log(error);
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    getLoggedInDriverData();

    // Cleanup: cancel request if component unmounts
    return () => {
      abortController.abort();
    };
  }, []);

  return { loading, driver };
};
