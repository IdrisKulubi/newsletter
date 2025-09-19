"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardData } from "@/lib/services/analytics";

interface PerformanceChartProps {
  data: DashboardData["performanceChart"];
  detailed?: boolean;
}

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(var(--chart-1))",
  },
  opened: {
    label: "Opened",
    color: "hsl(var(--chart-2))",
  },
  clicked: {
    label: "Clicked",
    color: "hsl(var(--chart-3))",
  },
  openRate: {
    label: "Open Rate",
    color: "hsl(var(--chart-2))",
  },
  clickRate: {
    label: "Click Rate",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function PerformanceChart({ data, detailed = false }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      openRate: item.sent > 0 ? (item.opened / item.sent) * 100 : 0,
      clickRate: item.sent > 0 ? (item.clicked / item.sent) * 100 : 0,
    }));
  }, [data]);

  if (!detailed) {
    return (
      <ChartContainer config={chartConfig}>
        <AreaChart
          accessibilityLayer
          data={chartData}
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
            tickFormatter={(value) => value}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Area
            dataKey="sent"
            type="natural"
            fill="var(--color-sent)"
            fillOpacity={0.4}
            stroke="var(--color-sent)"
            stackId="a"
          />
          <Area
            dataKey="opened"
            type="natural"
            fill="var(--color-opened)"
            fillOpacity={0.4}
            stroke="var(--color-opened)"
            stackId="a"
          />
          <Area
            dataKey="clicked"
            type="natural"
            fill="var(--color-clicked)"
            fillOpacity={0.4}
            stroke="var(--color-clicked)"
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>
    );
  }

  return (
    <Tabs defaultValue="volume" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="volume">Volume</TabsTrigger>
        <TabsTrigger value="rates">Rates</TabsTrigger>
        <TabsTrigger value="comparison">Comparison</TabsTrigger>
      </TabsList>

      <TabsContent value="volume" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Volume</CardTitle>
            <CardDescription>
              Number of emails sent, opened, and clicked over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={chartData}
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
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <ChartTooltip
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="sent" fill="var(--color-sent)" radius={4} />
                <Bar dataKey="opened" fill="var(--color-opened)" radius={4} />
                <Bar dataKey="clicked" fill="var(--color-clicked)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rates" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Rates</CardTitle>
            <CardDescription>
              Open and click rates as percentages over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart
                accessibilityLayer
                data={chartData}
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
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Line
                  dataKey="openRate"
                  type="monotone"
                  stroke="var(--color-openRate)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="clickRate"
                  type="monotone"
                  stroke="var(--color-clickRate)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="comparison" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Volume Trends</CardTitle>
              <CardDescription>
                Email volume over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
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
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="sent"
                    type="natural"
                    fill="var(--color-sent)"
                    fillOpacity={0.4}
                    stroke="var(--color-sent)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Engagement Trends</CardTitle>
              <CardDescription>
                Open and click rates over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <LineChart
                  accessibilityLayer
                  data={chartData}
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
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Line
                    dataKey="openRate"
                    type="monotone"
                    stroke="var(--color-openRate)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="clickRate"
                    type="monotone"
                    stroke="var(--color-clickRate)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}