"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  Clock,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { DateRange } from "@/lib/services/analytics";

interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  openRate: number;
  clickRate: number;
  engagementScore: number;
  lastActive: Date;
  growth: number; // percentage change
}

interface EngagementData {
  segment: string;
  opens: number;
  clicks: number;
  unsubscribes: number;
  complaints: number;
}

interface TimeBasedData {
  hour: number;
  opens: number;
  clicks: number;
}

interface AudienceSegmentationProps {
  dateRange: DateRange;
}

const chartConfig = {
  opens: {
    label: "Opens",
    color: "hsl(var(--chart-2))",
  },
  clicks: {
    label: "Clicks",
    color: "hsl(var(--chart-3))",
  },
  unsubscribes: {
    label: "Unsubscribes",
    color: "hsl(var(--chart-4))",
  },
  complaints: {
    label: "Complaints",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function AudienceSegmentation({ dateRange }: AudienceSegmentationProps) {
  const [loading, setLoading] = useState(true);
  const [segmentBy, setSegmentBy] = useState<"engagement" | "recency" | "behavior">("engagement");
  
  // Mock data - in real implementation, this would come from the analytics service
  const [segments] = useState<AudienceSegment[]>([
    {
      id: "highly-engaged",
      name: "Highly Engaged",
      size: 1250,
      openRate: 45.2,
      clickRate: 8.7,
      engagementScore: 92,
      lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      growth: 12.5,
    },
    {
      id: "moderately-engaged",
      name: "Moderately Engaged",
      size: 3400,
      openRate: 28.1,
      clickRate: 4.2,
      engagementScore: 65,
      lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      growth: 5.2,
    },
    {
      id: "low-engaged",
      name: "Low Engaged",
      size: 2100,
      openRate: 12.3,
      clickRate: 1.1,
      engagementScore: 28,
      lastActive: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      growth: -8.3,
    },
    {
      id: "inactive",
      name: "Inactive",
      size: 890,
      openRate: 3.2,
      clickRate: 0.2,
      engagementScore: 8,
      lastActive: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      growth: -15.7,
    },
  ]);

  const [engagementData] = useState<EngagementData[]>([
    { segment: "Highly Engaged", opens: 565, clicks: 109, unsubscribes: 2, complaints: 0 },
    { segment: "Moderately Engaged", opens: 955, clicks: 143, unsubscribes: 12, complaints: 1 },
    { segment: "Low Engaged", opens: 258, clicks: 23, unsubscribes: 18, complaints: 3 },
    { segment: "Inactive", opens: 29, clicks: 2, unsubscribes: 45, complaints: 8 },
  ]);

  const [timeBasedData] = useState<TimeBasedData[]>([
    { hour: 6, opens: 45, clicks: 8 },
    { hour: 7, opens: 89, clicks: 15 },
    { hour: 8, opens: 156, clicks: 28 },
    { hour: 9, opens: 234, clicks: 42 },
    { hour: 10, opens: 198, clicks: 35 },
    { hour: 11, opens: 167, clicks: 29 },
    { hour: 12, opens: 145, clicks: 25 },
    { hour: 13, opens: 123, clicks: 21 },
    { hour: 14, opens: 134, clicks: 23 },
    { hour: 15, opens: 156, clicks: 27 },
    { hour: 16, opens: 178, clicks: 31 },
    { hour: 17, opens: 145, clicks: 25 },
    { hour: 18, opens: 123, clicks: 21 },
    { hour: 19, opens: 98, clicks: 17 },
    { hour: 20, opens: 76, clicks: 13 },
    { hour: 21, opens: 54, clicks: 9 },
    { hour: 22, opens: 32, clicks: 5 },
    { hour: 23, opens: 21, clicks: 3 },
  ]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [dateRange, segmentBy]);

  const totalAudience = segments.reduce((sum, segment) => sum + segment.size, 0);
  const averageEngagement = segments.reduce((sum, segment) => sum + segment.engagementScore * segment.size, 0) / totalAudience;

  const pieChartData = segments.map((segment, index) => ({
    name: segment.name,
    value: segment.size,
    percentage: ((segment.size / totalAudience) * 100).toFixed(1),
    fill: COLORS[index % COLORS.length],
  }));

  const getEngagementLevel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "bg-green-500" };
    if (score >= 60) return { label: "Good", color: "bg-blue-500" };
    if (score >= 40) return { label: "Fair", color: "bg-yellow-500" };
    return { label: "Poor", color: "bg-red-500" };
  };

  const getGrowthTrend = (growth: number) => {
    if (growth > 0) return { icon: TrendingUp, color: "text-green-600", label: `+${growth}%` };
    if (growth < 0) return { icon: TrendingDown, color: "text-red-600", label: `${growth}%` };
    return { icon: TrendingUp, color: "text-gray-600", label: "0%" };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audience Segmentation</h2>
          <p className="text-muted-foreground">
            Understand your audience behavior and preferences
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={segmentBy} onValueChange={(value: any) => setSegmentBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Segment by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engagement">Engagement Level</SelectItem>
              <SelectItem value="recency">Activity Recency</SelectItem>
              <SelectItem value="behavior">Behavior Pattern</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audience</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAudience.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Active subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageEngagement.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Engagement score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Segment</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segments[1].name}</div>
            <p className="text-xs text-muted-foreground">
              {segments[1].size.toLocaleString()} subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+5.2%</div>
            <p className="text-xs text-muted-foreground">
              Overall audience growth
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="segments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Audience Distribution</CardTitle>
                <CardDescription>
                  Breakdown of your audience by engagement level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segment Details</CardTitle>
                <CardDescription>
                  Performance metrics for each segment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {segments.map((segment) => {
                    const engagement = getEngagementLevel(segment.engagementScore);
                    const trend = getGrowthTrend(segment.growth);
                    const TrendIcon = trend.icon;

                    return (
                      <div key={segment.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{segment.name}</span>
                            <Badge className={`${engagement.color} text-white text-xs`}>
                              {engagement.label}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                            <span className={`text-xs ${trend.color}`}>{trend.label}</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {segment.size.toLocaleString()} subscribers • 
                          {segment.openRate}% open rate • 
                          {segment.clickRate}% click rate
                        </div>
                        <Progress value={segment.engagementScore} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement by Segment</CardTitle>
              <CardDescription>
                Detailed engagement metrics across audience segments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <BarChart
                  data={engagementData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="segment" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="opens" fill="var(--color-opens)" />
                  <Bar dataKey="clicks" fill="var(--color-clicks)" />
                  <Bar dataKey="unsubscribes" fill="var(--color-unsubscribes)" />
                  <Bar dataKey="complaints" fill="var(--color-complaints)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimal Send Times</CardTitle>
              <CardDescription>
                When your audience is most engaged throughout the day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <BarChart
                  data={timeBasedData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(value) => `${value}:00`}
                  />
                  <YAxis />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => `${value}:00`}
                  />
                  <Bar dataKey="opens" fill="var(--color-opens)" />
                  <Bar dataKey="clicks" fill="var(--color-clicks)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Peak Engagement Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Best Open Time</span>
                    <span className="text-sm font-medium">9:00 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Best Click Time</span>
                    <span className="text-sm font-medium">9:00 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Worst Time</span>
                    <span className="text-sm font-medium">11:00 PM</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>• Send campaigns between 8-10 AM for best results</p>
                  <p>• Avoid sending after 9 PM</p>
                  <p>• Consider time zones for global audiences</p>
                  <p>• Test different days of the week</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>
                  AI-powered audience analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Growth Opportunity</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Your "Moderately Engaged" segment shows potential for improvement. 
                      Consider targeted re-engagement campaigns.
                    </p>
                  </div>

                  <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Timing Optimization</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Your audience is most active at 9 AM. Consider scheduling 
                      important campaigns during this time.
                    </p>
                  </div>

                  <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">Attention Needed</span>
                    </div>
                    <p className="text-sm text-red-700">
                      890 subscribers are inactive. Consider a win-back campaign 
                      or list cleaning to improve deliverability.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
                <CardDescription>
                  Recommended next steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">Create re-engagement campaign</p>
                      <p className="text-xs text-muted-foreground">
                        Target low-engaged subscribers with special offers
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">Optimize send times</p>
                      <p className="text-xs text-muted-foreground">
                        Schedule campaigns for 9 AM peak engagement
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">Clean inactive subscribers</p>
                      <p className="text-xs text-muted-foreground">
                        Remove or segment inactive users to improve metrics
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium">Personalize content</p>
                      <p className="text-xs text-muted-foreground">
                        Create segment-specific content for better engagement
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}