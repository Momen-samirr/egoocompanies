import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useEffect, useState } from "react";
import { getServerUri } from "@/configs/constants";

export const useGetUserData = () => {
  const [user, setUser] = useState<UserType>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getLoggedInUserData = async () => {
      const accessToken = await AsyncStorage.getItem("accessToken");
      await axios
        .get(`${getServerUri()}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .then((res) => {
          setUser(res.data.user);
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    };
    getLoggedInUserData();
  }, []);

  return { loading, user };
};
