import AsyncStorage from "@react-native-async-storage/async-storage";

export const storeParentToken = async (token: string) => {
  await AsyncStorage.setItem("parentToken", token);
};

export const getParentToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("parentToken");
};

export const removeParentToken = async () => {
  await AsyncStorage.removeItem("parentToken");
};

export const storeParentData = async (parent: any) => {
  await AsyncStorage.setItem("parentData", JSON.stringify(parent));
};

export const getParentData = async (): Promise<any | null> => {
  const data = await AsyncStorage.getItem("parentData");
  return data ? JSON.parse(data) : null;
};

export const removeParentData = async () => {
  await AsyncStorage.removeItem("parentData");
};







