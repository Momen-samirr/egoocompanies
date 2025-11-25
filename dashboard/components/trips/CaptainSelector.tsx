"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useDebounce } from "@/hooks/useDebounce";
import api from "@/lib/api";

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  status: string;
}

interface CaptainSelectorProps {
  value?: string;
  onChange: (captainId: string | undefined) => void;
  error?: { message?: string };
  disabled?: boolean;
}

export default function CaptainSelector({
  value,
  onChange,
  error,
  disabled = false,
}: CaptainSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch selected captain details when value changes (only on initial load or external change)
  useEffect(() => {
    // Only fetch if value is set and searchTerm is empty (not actively searching)
    if (!value || searchTerm.trim()) {
      return; // Early return if conditions not met
    }

    let isMounted = true;
    const fetchSelectedCaptain = async () => {
      try {
        const response = await api.get(`/admin/drivers/${value}`);
        if (isMounted && response.data.success && response.data.driver) {
          const driver = response.data.driver;
          setSearchTerm(`${driver.name} (${driver.phone_number})`);
        }
      } catch (error: any) {
        // Ignore AbortError and canceled requests
        if (error.name !== "AbortError" && error.code !== "ERR_CANCELED" && isMounted) {
          console.error("Error fetching selected captain:", error);
        }
      }
    };
    
    fetchSelectedCaptain();
    
    return () => {
      isMounted = false;
    };
  }, [value, searchTerm]); // Include searchTerm to properly track when it's empty

  // Fetch drivers based on debounced search
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchDrivers = async () => {
      setIsLoading(true);
      setHasSearched(true);

      try {
        const searchQuery = debouncedSearch.trim();
        const params = new URLSearchParams({
          limit: "50",
          includeAll: "true",
        });

        if (searchQuery) {
          params.append("search", searchQuery);
        }

        const response = await api.get(`/admin/drivers?${params.toString()}`, {
          signal: abortController.signal,
        });

        if (isMounted && response.data.success) {
          setDrivers(response.data.drivers || []);
        } else if (isMounted) {
          setDrivers([]);
        }
      } catch (error: any) {
        // Ignore AbortError - it's expected when requests are cancelled
        if (error.name === "AbortError" || error.code === "ERR_CANCELED") {
          return;
        }
        if (isMounted) {
          console.error("Error fetching drivers:", error);
          setDrivers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDrivers();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [debouncedSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < drivers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && drivers[selectedIndex]) {
          handleSelectDriver(drivers[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedIndex]);

  const handleSelectDriver = useCallback(
    (driver: Driver) => {
      onChange(driver.id);
      setSearchTerm(`${driver.name} (${driver.phone_number})`);
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleClear = () => {
    setSearchTerm("");
    onChange(undefined);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);

    // If input is cleared, clear selection
    if (!newValue.trim()) {
      onChange(undefined);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // If we have a search term, show results
    if (searchTerm.trim() || !hasSearched) {
      // Trigger search if we haven't searched yet
      if (!hasSearched) {
        setHasSearched(true);
      }
    }
  };

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const selectedDriver = drivers.find((d) => d.id === value);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Search by phone number, name, or email..."
          className={`w-full pl-10 pr-10 py-2.5 border ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
          } rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all duration-200 bg-white disabled:bg-gray-50 disabled:cursor-not-allowed`}
          aria-label="Search for captain"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="captain-listbox"
          role="combobox"
        />
        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              <span className="ml-2">Searching...</span>
            </div>
          ) : drivers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {hasSearched
                ? "No captains found. Try a different search term."
                : "Start typing to search for captains..."}
            </div>
          ) : (
            <ul
              ref={listRef}
              id="captain-listbox"
              role="listbox"
              className="py-1"
            >
              {drivers.map((driver, index) => (
                <li
                  key={driver.id}
                  role="option"
                  aria-selected={selectedIndex === index || driver.id === value}
                  onClick={() => handleSelectDriver(driver)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    selectedIndex === index || driver.id === value
                      ? "bg-indigo-50 text-indigo-900"
                      : "hover:bg-gray-50 text-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {highlightText(driver.name, debouncedSearch)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {highlightText(driver.phone_number, debouncedSearch)}
                      </div>
                      {driver.email && (
                        <div className="text-xs text-gray-500">
                          {highlightText(driver.email, debouncedSearch)}
                        </div>
                      )}
                    </div>
                    {driver.status && (
                      <span
                        className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                          driver.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {driver.status}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <span>⚠</span>
          <span>{error.message}</span>
        </p>
      )}
    </div>
  );
}

