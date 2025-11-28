import { useState, useCallback } from "react";
import { ScheduledTrip } from "@/types/trip";

export type ModalType = "edit" | "view" | "status" | null;

export function useTripModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedTrip, setSelectedTrip] = useState<ScheduledTrip | null>(null);

  const openModal = useCallback((type: ModalType, trip: ScheduledTrip | null = null) => {
    setModalType(type);
    setSelectedTrip(trip);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setModalType(null);
    setSelectedTrip(null);
  }, []);

  return {
    isOpen,
    modalType,
    selectedTrip,
    openModal,
    closeModal,
  };
}

