import color from "@/themes/app.colors";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spaceBelow: {
    paddingBottom: windowHeight(10),
  },
  rideContainer: {
    paddingHorizontal: windowWidth(20),
    paddingTop: windowHeight(5),
    paddingBottom: windowHeight(10),
  },
  rideTitle: {
    marginVertical: windowHeight(5),
    fontSize: fontSizes.FONT25,
    fontFamily: fonts.medium,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: color.modelBg,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: windowHeight(20),
    paddingHorizontal: windowWidth(20),
    paddingBottom: windowHeight(30),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: windowHeight(20),
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.FONT24,
    fontWeight: "600",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    width: "80%",
    justifyContent: "space-between",
    marginTop: windowHeight(2),
  },
  button: {
    backgroundColor: color.primary,
    width: windowWidth(20),
    height: windowHeight(5),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: fonts.medium,
    color: color.whiteColor,
  },
  mainContainer: {
    alignItems: "center",
  },
  leftView: {
    marginRight: windowWidth(3),
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: windowHeight(5),
  },
  rightView: {
    paddingTop: windowHeight(5),
  },
  border: {
    borderStyle: "dashed",
    borderBottomWidth: 0.5,
    borderColor: color.border,
    marginVertical: windowHeight(1.5),
  },
  verticaldot: {
    borderLeftWidth: 1,
    marginHorizontal: 5,
  },
  pickup: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.regular,
  },
  drop: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.regular,
    paddingTop: windowHeight(10),
  },
});
export default styles;
