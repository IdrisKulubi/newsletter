"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Crown, Award, Medal } from "lucide-react";
import { DashboardData } from "@/lib/services/analytics";

interface TopPerformersProps {
  campaigns: DashboardData["topPerformingCampaigns"];
}

export function TopPerformers({ campaigns }: TopPerformersProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No campaign data available yet.
        </p>
      </div>
    );
  }

  const maxOpenRate = Math.max(...campaigns.map(c => c.openRate));
  const maxClickRate = Math.max(...campaigns.map(c => c.clickRate));

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Award className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Medal className="h-4 w-4 text-amber-600" />;
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPerformanceLevel = (openRate: number, clickRate: number) => {
    const openBenchmark = 25; // Industry average
    const clickBenchmark = 3; // Industry average
    
    const openScore = (openRate / openBenchmark) * 100;
    const clickScore = (clickRate / clickBenchmark) * 100;
    const avgScore = (openScore + clickScore) / 2;

    if (avgScore >= 120) return { label: "Excellent", color: "bg-green-500" };
    if (avgScore >= 100) return { label: "Good", color: "bg-blue-500" };
    if (avgScore >= 80) return { label: "Average", color: "bg-yellow-500" };
    return { label: "Needs Improvement", color: "bg-red-500" };
  };

  return (
    <div className="space-y-4">
      {campaigns.map((campaign, index) => {
        const performance = getPerformanceLevel(campaign.openRate, campaign.clickRate);
        const openProgress = maxOpenRate > 0 ? (campaign.openRate / maxOpenRate) * 100 : 0;
        const clickProgress = maxClickRate > 0 ? (campaign.clickRate / maxClickRate) * 100 : 0;

        return (
          <Card key={campaign.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getRankIcon(index)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">
                      {campaign.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Rank #{index + 1}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`${performance.color} text-white text-xs`}
                >
                  {performance.label}
                </Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">Open Rate</span>
                    <span className="text-xs font-medium">{campaign.openRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={openProgress} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">Click Rate</span>
                    <span className="text-xs font-medium">{campaign.clickRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={clickProgress} className="h-2" />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    vs Industry Avg
                  </span>
                  <div className="flex space-x-3">
                    <span className={campaign.openRate >= 25 ? "text-green-600" : "text-red-600"}>
                      Open: {campaign.openRate >= 25 ? "+" : ""}{(campaign.openRate - 25).toFixed(1)}%
                    </span>
                    <span className={campaign.clickRate >= 3 ? "text-green-600" : "text-red-600"}>
                      Click: {campaign.clickRate >= 3 ? "+" : ""}{(campaign.clickRate - 3).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {campaigns.length < 5 && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Send more campaigns to see additional top performers
          </p>
        </div>
      )}
    </div>
  );
}