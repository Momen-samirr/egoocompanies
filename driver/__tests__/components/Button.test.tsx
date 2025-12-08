/**
 * Component tests for Button
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Button from "@/components/common/button";

describe("Button Component", () => {
  test("should render with title", () => {
    const { getByText } = render(<Button title="Test Button" onPress={() => {}} />);
    expect(getByText("Test Button")).toBeTruthy();
  });

  test("should call onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Test Button" onPress={onPress} />);
    
    fireEvent.press(getByText("Test Button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("should be disabled when disabled prop is true", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Test Button" onPress={onPress} disabled={true} />
    );
    
    const button = getByText("Test Button").parent;
    expect(button?.props.accessibilityState.disabled).toBe(true);
  });

  test("should have accessibility label", () => {
    const { getByLabelText } = render(
      <Button title="Test Button" onPress={() => {}} />
    );
    expect(getByLabelText("Test Button")).toBeTruthy();
  });
});

