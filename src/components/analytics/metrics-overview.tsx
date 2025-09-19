"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Eye, 
  MousePointer, 
  TrendingUp, 
  TrendingDown,
  Minus
} from "lucide-react";
import { DashboardData } from "@/lib/services/analytics";

interface MetricsOverviewProps {
  data: DashboardData;
}

export function MetricsOverview({ data }: MetricsOverviewProps) {
  const metrics = [
    {
      title: "Total Campaigns",
      value: data.totalCampaigns.toLocaleString(),
      icon: Mail,
      description: "Active campaigns",
      trend: null, // Could be calculated from historical data
    },
    {
      title: "Total Sent",
      value: data.totalSent.toLocaleString(),
      icon: Mail,
      description: "Emails delivered",
      trend: null,
    },
    {
      title: "Average Open Rate",
      value: `${data.averageOpenRate.toFixed(1)}%`,
      icon: Eye,
      description: "Across all campaigns",
      trend: getTrend(data.averageOpenRate, 25), // Industry average ~25%
    },
    {
      title: "Average Click Rate",
      value: `${data.averageClickRate.toFixed(1)}%`,
      icon: MousePointer,
      description: "Across all campaigns",
      trend: getTrend(data.averageClickRate, 3), // Industry average ~3%
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.trend && (
                <Badge
                  variant={
                    metric.trend.direction === "up"
                      ? "default"
                      : metric.trend.direction === "down"
                      ? "destructive"
                      : "secondary"
                  }
                  className="ml-2"
                >
                  {metric.trend.direction === "up" && (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  )}
                  {metric.trend.direction === "down" && (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {metric.trend.direction === "neutral" && (
                    <Minus className="h-3 w-3 mr-1" />
                  )}
                  {metric.trend.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getTrend(value: number, benchmark: number) {
  const difference = value - benchmark;
  const percentDifference = Math.abs((difference / benchmark) * 100);
  
  if (Math.abs(difference) < 0.5) {
    return {
      direction: "neutral" as const,
      label: "On target",
    };
  }
  
  return {
    direction: difference > 0 ? ("up" as const) : ("down" as const),
    label: `${percentDifference.toFixed(0)}% vs industry`,
  };
}