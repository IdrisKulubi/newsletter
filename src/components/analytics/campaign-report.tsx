"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Mail,
  Eye,
  MousePointer,
  AlertTriangle,
  UserMinus,
  Flag,
  ExternalLink,
  Download,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { CampaignReport } from "@/lib/services/analytics";
import { getCampaignReport } from "@/lib/actions/analytics/get-campaign-report";

interface CampaignReportProps {
  campaignId: string;
  initialData?: CampaignReport;
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
} satisfies ChartConfig;

export function CampaignReportComponent({ campaignId, initialData }: CampaignReportProps) {
  const [data, setData] = useState<CampaignReport | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getCampaignReport(campaignId);
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to load campaign report");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [campaignId]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const metrics = [
    {
      title: "Total Sent",
      value: data.totalSent.toLocaleString(),
      icon: Mail,
      description: "Emails delivered",
    },
    {
      title: "Opens",
      value: `${data.opened.toLocaleString()} (${data.openRate}%)`,
      icon: Eye,
      description: `${data.uniqueOpens} unique opens`,
    },
    {
      title: "Clicks",
      value: `${data.clicked.toLocaleString()} (${data.clickRate}%)`,
      icon: MousePointer,
      description: `${data.uniqueClicks} unique clicks`,
    },
    {
      title: "Issues",
      value: (data.bounced + data.complained).toLocaleString(),
      icon: AlertTriangle,
      description: `${data.bounced} bounces, ${data.complained} complaints`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.campaignName}</h1>
          <p className="text-muted-foreground">
            Campaign Performance Report
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
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
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="links">Top Links</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>
                  Key metrics and benchmarks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Open Rate</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.openRate}%</span>
                      <Badge variant={data.openRate >= 25 ? "default" : "secondary"}>
                        {data.openRate >= 25 ? "Above" : "Below"} Industry Avg
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Click Rate</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.clickRate}%</span>
                      <Badge variant={data.clickRate >= 3 ? "default" : "secondary"}>
                        {data.clickRate >= 3 ? "Above" : "Below"} Industry Avg
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Bounce Rate</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.bounceRate}%</span>
                      <Badge variant={data.bounceRate <= 2 ? "default" : "destructive"}>
                        {data.bounceRate <= 2 ? "Good" : "High"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Breakdown</CardTitle>
                <CardDescription>
                  Detailed engagement statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Delivered</span>
                    <span className="text-sm font-medium">{data.delivered.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unique Opens</span>
                    <span className="text-sm font-medium">{data.uniqueOpens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Opens</span>
                    <span className="text-sm font-medium">{data.opened.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unique Clicks</span>
                    <span className="text-sm font-medium">{data.uniqueClicks.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Clicks</span>
                    <span className="text-sm font-medium">{data.clicked.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unsubscribes</span>
                    <span className="text-sm font-medium">{data.unsubscribed.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Timeline</CardTitle>
              <CardDescription>
                Opens and clicks over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={data.timeline}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="opens"
                    type="natural"
                    fill="var(--color-opens)"
                    fillOpacity={0.4}
                    stroke="var(--color-opens)"
                    stackId="a"
                  />
                  <Area
                    dataKey="clicks"
                    type="natural"
                    fill="var(--color-clicks)"
                    fillOpacity={0.4}
                    stroke="var(--color-clicks)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Links</CardTitle>
              <CardDescription>
                Most clicked links in your campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topLinks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No link clicks recorded for this campaign.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link URL</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topLinks.map((link, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[300px]" title={link.url}>
                              {link.url}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {link.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {((link.clicks / data.clicked) * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(link.url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounces</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.bounced}</div>
                <p className="text-xs text-muted-foreground">
                  {data.bounceRate}% bounce rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unsubscribes</CardTitle>
                <UserMinus className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.unsubscribed}</div>
                <p className="text-xs text-muted-foreground">
                  {((data.unsubscribed / data.totalSent) * 100).toFixed(2)}% unsubscribe rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Complaints</CardTitle>
                <Flag className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.complained}</div>
                <p className="text-xs text-muted-foreground">
                  {((data.complained / data.totalSent) * 100).toFixed(3)}% complaint rate
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Issue Analysis</CardTitle>
              <CardDescription>
                Recommendations to improve deliverability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.bounceRate > 2 && (
                  <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-orange-800">High Bounce Rate</span>
                    </div>
                    <p className="text-sm text-orange-700">
                      Your bounce rate of {data.bounceRate}% is above the recommended 2%. 
                      Consider cleaning your email list and removing invalid addresses.
                    </p>
                  </div>
                )}

                {((data.unsubscribed / data.totalSent) * 100) > 0.5 && (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <UserMinus className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">High Unsubscribe Rate</span>
                    </div>
                    <p className="text-sm text-red-700">
                      Your unsubscribe rate is above 0.5%. Review your content relevance 
                      and sending frequency to improve subscriber retention.
                    </p>
                  </div>
                )}

                {((data.complained / data.totalSent) * 100) > 0.1 && (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <Flag className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">Spam Complaints</span>
                    </div>
                    <p className="text-sm text-red-700">
                      You have received spam complaints. Ensure you have proper opt-in 
                      processes and clear unsubscribe options.
                    </p>
                  </div>
                )}

                {data.bounceRate <= 2 && 
                 ((data.unsubscribed / data.totalSent) * 100) <= 0.5 && 
                 ((data.complained / data.totalSent) * 100) <= 0.1 && (
                  <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <Eye className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Good Deliverability</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Your campaign shows healthy deliverability metrics. Keep up the good work!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}