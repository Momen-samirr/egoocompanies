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
  UserIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

interface CompanyFormState {
  name: string;
  defaultScheduledTripPrice: string;
}

interface CompanyAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  company?: Company;
  createdAt: string;
  updatedAt: string;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  vehicle_type: string;
  status: string;
}

export default function CompaniesPage() {
  const [activeTab, setActiveTab] = useState<"companies" | "accounts">("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingAccount, setEditingAccount] = useState<CompanyAccount | null>(null);
  const [selectedCompanyForDrivers, setSelectedCompanyForDrivers] = useState<Company | null>(null);
  const [companyDrivers, setCompanyDrivers] = useState<Driver[]>([]);
  const [formState, setFormState] = useState<CompanyFormState>({
    name: "",
    defaultScheduledTripPrice: "",
  });
  const [accountFormState, setAccountFormState] = useState({
    name: "",
    email: "",
    password: "",
    companyId: "",
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

  const fetchCompanyAccounts = useCallback(async () => {
    try {
      const response = await api.get("/admin/company-accounts");
      setCompanyAccounts(response.data.companyAccounts || []);
    } catch (error) {
      console.error("Error fetching company accounts:", error);
      toast.error(getErrorMessage(error, "Failed to load company accounts"));
    }
  }, []);

  const fetchAllDrivers = useCallback(async () => {
    try {
      const response = await api.get("/admin/drivers", { params: { limit: 1000 } });
      setAllDrivers(response.data.drivers || []);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast.error(getErrorMessage(error, "Failed to load drivers"));
    }
  }, []);

  const fetchCompanyDrivers = useCallback(async (companyId: string) => {
    try {
      const response = await api.get(`/admin/companies/${companyId}/drivers`);
      setCompanyDrivers(response.data.drivers || []);
    } catch (error) {
      console.error("Error fetching company drivers:", error);
      toast.error(getErrorMessage(error, "Failed to load company drivers"));
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    fetchCompanyAccounts();
    fetchAllDrivers();
  }, [fetchCompanies, fetchCompanyAccounts, fetchAllDrivers]);

  const resetForm = () => {
    setEditingCompany(null);
    setFormState({
      name: "",
      defaultScheduledTripPrice: "",
    });
  };

  const resetAccountForm = () => {
    setEditingAccount(null);
    setAccountFormState({
      name: "",
      email: "",
      password: "",
      companyId: "",
    });
  };

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountFormState.name || !accountFormState.email || !accountFormState.companyId) {
      toast.error("Name, email, and company are required");
      return;
    }
    if (!editingAccount && !accountFormState.password) {
      toast.error("Password is required for new accounts");
      return;
    }

    try {
      setSaving(true);
      if (editingAccount) {
        await api.put(`/admin/company-accounts/${editingAccount.id}`, {
          name: accountFormState.name,
          email: accountFormState.email,
          password: accountFormState.password || undefined,
          companyId: accountFormState.companyId,
        });
        toast.success("Company account updated");
      } else {
        await api.post("/admin/company-accounts", {
          name: accountFormState.name,
          email: accountFormState.email,
          password: accountFormState.password,
          companyId: accountFormState.companyId,
        });
        toast.success("Company account created");
      }
      resetAccountForm();
      fetchCompanyAccounts();
    } catch (error) {
      console.error("Error saving company account:", error);
      toast.error(getErrorMessage(error, "Failed to save company account"));
    } finally {
      setSaving(false);
    }
  };

  const handleAccountEdit = (account: CompanyAccount) => {
    setEditingAccount(account);
    setAccountFormState({
      name: account.name,
      email: account.email,
      password: "",
      companyId: account.companyId || "",
    });
  };

  const handleAccountDelete = async (account: CompanyAccount) => {
    if (!confirm(`Delete company account "${account.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/company-accounts/${account.id}`);
      toast.success("Company account deleted");
      if (editingAccount?.id === account.id) {
        resetAccountForm();
      }
      fetchCompanyAccounts();
    } catch (error) {
      console.error("Error deleting company account:", error);
      toast.error(getErrorMessage(error, "Failed to delete company account"));
    }
  };

  const handleAssignDrivers = async (companyId: string, driverIds: string[]) => {
    try {
      await api.post(`/admin/companies/${companyId}/assign-drivers`, {
        driverIds,
      });
      toast.success("Drivers assigned successfully");
      fetchCompanyDrivers(companyId);
    } catch (error) {
      console.error("Error assigning drivers:", error);
      toast.error(getErrorMessage(error, "Failed to assign drivers"));
    }
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
            Manage companies, company accounts, and driver assignments
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("companies")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "companies"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Companies
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "accounts"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Company Accounts
          </button>
        </nav>
      </div>

      {activeTab === "companies" && (

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
      )}

      {activeTab === "accounts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingAccount ? "Edit Account" : "Create Account"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Create login accounts for companies
                  </p>
                </div>
                {editingAccount && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XMarkIcon}
                    onClick={resetAccountForm}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={handleAccountSubmit}>
                <FormField label="Account Name" required>
                  <input
                    type="text"
                    value={accountFormState.name}
                    onChange={(e) =>
                      setAccountFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., School Admin"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </FormField>

                <FormField label="Email (Username)" required>
                  <input
                    type="email"
                    value={accountFormState.email}
                    onChange={(e) =>
                      setAccountFormState((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="admin@company.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </FormField>

                <FormField label={editingAccount ? "New Password (leave blank to keep current)" : "Password"} required={!editingAccount}>
                  <input
                    type="password"
                    value={accountFormState.password}
                    onChange={(e) =>
                      setAccountFormState((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </FormField>

                <FormField label="Company" required>
                  <select
                    value={accountFormState.companyId}
                    onChange={(e) =>
                      setAccountFormState((prev) => ({ ...prev, companyId: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <Button
                  type="submit"
                  icon={editingAccount ? PencilIcon : PlusIcon}
                  disabled={saving}
                  className="w-full"
                >
                  {editingAccount ? "Update Account" : "Create Account"}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Company Accounts</h2>
                  <p className="text-sm text-gray-500">
                    {companyAccounts.length} account(s) configured
                  </p>
                </div>
                <Button variant="ghost" onClick={fetchCompanyAccounts}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardBody padding="none">
              {companyAccounts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No company accounts configured yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {companyAccounts.map((account) => (
                        <tr key={account.id} className="hover:bg-indigo-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {account.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {account.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {account.company?.name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={PencilIcon}
                                onClick={() => handleAccountEdit(account)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={TruckIcon}
                                onClick={() => {
                                  setSelectedCompanyForDrivers(account.company || null);
                                  if (account.companyId) {
                                    fetchCompanyDrivers(account.companyId);
                                  }
                                }}
                              >
                                Assign Drivers
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                icon={TrashIcon}
                                onClick={() => handleAccountDelete(account)}
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
      )}

      {/* Driver Assignment Modal */}
      {selectedCompanyForDrivers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Assign Drivers to {selectedCompanyForDrivers.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Select drivers to assign to this company
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XMarkIcon}
                  onClick={() => {
                    setSelectedCompanyForDrivers(null);
                    setCompanyDrivers([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {allDrivers.map((driver) => {
                    const isAssigned = companyDrivers.some((cd) => cd.id === driver.id);
                    return (
                      <label
                        key={driver.id}
                        className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleAssignDrivers(selectedCompanyForDrivers.id, [
                                ...companyDrivers.map((d) => d.id),
                                driver.id,
                              ]);
                            } else {
                              handleAssignDrivers(
                                selectedCompanyForDrivers.id,
                                companyDrivers.filter((d) => d.id !== driver.id).map((d) => d.id)
                              );
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                          <div className="text-xs text-gray-500">
                            {driver.email} • {driver.vehicle_type} • {driver.status}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="text-sm text-gray-600">
                  {companyDrivers.length} driver(s) assigned to this company
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

