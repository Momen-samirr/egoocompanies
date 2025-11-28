import { useState, useCallback } from "react";

export function useTripPagination(initialPage = 1, initialPageSize = 25) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when page size changes
  }, []);

  const reset = useCallback(() => {
    setPage(1);
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  return {
    page,
    pageSize,
    goToPage,
    changePageSize,
    reset,
  };
}

