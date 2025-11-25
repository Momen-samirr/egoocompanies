"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import Card, { CardBody, CardHeader } from "@/components/common/Card";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FormField from "@/components/common/FormField";
import { Company } from "@/types";
import {
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface CompanyFormState {
  name: string;
  defaultScheduledTripPrice: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formState, setFormState] = useState<CompanyFormState>({
    name: "",
    defaultScheduledTripPrice: "",
  });

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
        "string"
    ) {
      return (
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        fallback
      );
    }
    return fallback;
  };

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/companies");
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error(getErrorMessage(error, "Failed to load companies"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const resetForm = () => {
    setEditingCompany(null);
    setFormState({
      name: "",
      defaultScheduledTripPrice: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedPrice = parseFloat(formState.defaultScheduledTripPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    try {
      setSaving(true);
      if (editingCompany) {
        await api.put(`/admin/companies/${editingCompany.id}`, {
          name: formState.name,
          defaultScheduledTripPrice: parsedPrice,
        });
        toast.success("Company updated");
      } else {
        await api.post("/admin/companies", {
          name: formState.name,
          defaultScheduledTripPrice: parsedPrice,
        });
        toast.success("Company created");
      }
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(getErrorMessage(error, "Failed to save company"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormState({
      name: company.name,
      defaultScheduledTripPrice: company.defaultScheduledTripPrice.toString(),
    });
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Delete company "${company.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/companies/${company.id}`);
      toast.success("Company deleted");
      if (editingCompany?.id === company.id) {
        resetForm();
      }
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error(getErrorMessage(error, "Failed to delete company"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage company-level scheduled trip pricing
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingCompany ? "Edit Company" : "Add Company"}
                </h2>
                <p className="text-sm text-gray-500">
                  Set default scheduled trip pricing per company
                </p>
              </div>
              {editingCompany && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XMarkIcon}
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <FormField
                label="Company Name"
                required
              >
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g., RideWave Logistics"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>

              <FormField
                label="Default Scheduled Trip Price"
                required
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.defaultScheduledTripPrice}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      defaultScheduledTripPrice: event.target.value,
                    }))
                  }
                  placeholder="e.g., 15.00"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>

              <Button
                type="submit"
                icon={editingCompany ? PencilIcon : PlusIcon}
                disabled={saving}
                className="w-full"
              >
                {editingCompany ? "Update Company" : "Add Company"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Company Directory
                </h2>
                <p className="text-sm text-gray-500">
                  {companies.length} companies configured
                </p>
              </div>
              <Button variant="ghost" onClick={fetchCompanies}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardBody padding="none">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Loading companies..." />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No companies configured yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Default Trip Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {companies.map((company) => (
                      <tr key={company.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {company.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          ${company.defaultScheduledTripPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={PencilIcon}
                              onClick={() => handleEdit(company)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={TrashIcon}
                              onClick={() => handleDelete(company)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

