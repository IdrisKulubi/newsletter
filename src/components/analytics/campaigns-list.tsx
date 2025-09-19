"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Search, 
  Eye, 
  MousePointer, 
  Calendar,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { format } from "date-fns";
import { DashboardData } from "@/lib/services/analytics";

interface CampaignsListProps {
  campaigns: DashboardData["recentCampaigns"];
}

export function CampaignsList({ campaigns }: CampaignsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "sentAt" | "openRate" | "clickRate">("sentAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredAndSortedCampaigns = campaigns
    .filter((campaign) =>
      campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === "sentAt") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getPerformanceBadge = (rate: number, type: "open" | "click") => {
    const benchmark = type === "open" ? 25 : 3; // Industry benchmarks
    const variant = rate >= benchmark ? "default" : rate >= benchmark * 0.7 ? "secondary" : "destructive";
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {rate >= benchmark ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {rate.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>
              Overview of your latest email campaigns
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAndSortedCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm ? "No campaigns found matching your search." : "No campaigns found."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("name")}
                    className="h-auto p-0 font-semibold"
                  >
                    Campaign Name
                    {sortBy === "name" && (
                      sortOrder === "asc" ? <TrendingUp className="ml-1 h-3 w-3" /> : <TrendingDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("sentAt")}
                    className="h-auto p-0 font-semibold"
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    Sent Date
                    {sortBy === "sentAt" && (
                      sortOrder === "asc" ? <TrendingUp className="ml-1 h-3 w-3" /> : <TrendingDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("openRate")}
                    className="h-auto p-0 font-semibold"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Open Rate
                    {sortBy === "openRate" && (
                      sortOrder === "asc" ? <TrendingUp className="ml-1 h-3 w-3" /> : <TrendingDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("clickRate")}
                    className="h-auto p-0 font-semibold"
                  >
                    <MousePointer className="mr-1 h-3 w-3" />
                    Click Rate
                    {sortBy === "clickRate" && (
                      sortOrder === "asc" ? <TrendingUp className="ml-1 h-3 w-3" /> : <TrendingDown className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{campaign.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {campaign.id.slice(0, 8)}...
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(campaign.sentAt), "MMM dd, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(campaign.sentAt), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPerformanceBadge(campaign.openRate, "open")}
                  </TableCell>
                  <TableCell>
                    {getPerformanceBadge(campaign.clickRate, "click")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => navigator.clipboard.writeText(campaign.id)}
                        >
                          Copy campaign ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuItem>View report</DropdownMenuItem>
                        <DropdownMenuItem>Export data</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}