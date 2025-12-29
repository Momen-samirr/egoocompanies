"use client";

import { useQuery } from "@tanstack/react-query";
import { useCompanyContext } from "@/lib/providers/CompanyProvider";
import { getUserRole, getCompanyId } from "@/lib/auth";
import api from "@/lib/api";
import { Company } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function CompanySelector() {
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyContext();
  const userRole = getUserRole();
  const userCompanyId = getCompanyId();

  // Fetch companies list (used by both COMPANY and ADMIN users)
  const { data: companiesData, isLoading } = useQuery<{ companies: Company[] }>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await api.get("/admin/companies");
      return res.data;
    },
  });

  const companies = companiesData?.companies || [];

  // For COMPANY role users, show readonly display
  if (userRole === "COMPANY" && userCompanyId) {
    const company = companies.find((c) => c.id === userCompanyId);
    const companyName = company?.name || "Company";
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Company:</span>
        <Badge variant="secondary" className="text-sm font-medium">
          {companyName}
        </Badge>
      </div>
    );
  }

  // If COMPANY role but no companyId, don't render anything
  if (userRole === "COMPANY") {
    return null;
  }

  const handleValueChange = (value: string) => {
    if (value === "all") {
      setSelectedCompanyId(null);
    } else {
      setSelectedCompanyId(value);
    }
  };

  const displayValue = selectedCompanyId || "all";
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Company:</span>
      <Select
        value={displayValue}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="All Companies">
            {isLoading
              ? "Loading..."
              : selectedCompany
              ? selectedCompany.name
              : "All Companies"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Companies</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

