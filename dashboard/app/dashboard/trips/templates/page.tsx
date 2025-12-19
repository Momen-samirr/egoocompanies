"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { PlusIcon } from "@heroicons/react/24/outline";
import { TripTemplate } from "@/types/trip";
import TripTemplateCard from "@/components/trips/TripTemplateCard";
import Pagination from "@/components/common/Pagination";

export default function TripTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [page, searchQuery]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await api.get(
        `/admin/trip-templates?${params.toString()}`
      );
      setTemplates(response.data.templates || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/trip-templates/${id}`);
      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trip Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create reusable trip templates for efficient bulk trip creation
          </p>
        </div>
        <Button
          onClick={() => router.push("/dashboard/trips/templates/create")}
          icon={PlusIcon}
        >
          Create Template
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search templates..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading templates..." />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No templates found" : "No templates yet"}
          description={
            searchQuery
              ? "Try adjusting your search query"
              : "Create your first template to get started"
          }
          action={
            !searchQuery
              ? {
                  label: "Create Template",
                  onClick: () =>
                    router.push("/dashboard/trips/templates/create"),
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TripTemplateCard
                key={template.id}
                template={template}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={() => {}} // Keep same page size
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
