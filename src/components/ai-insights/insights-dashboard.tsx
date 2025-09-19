/**
 * AI Insights Dashboard Component
 * Displays AI-generated campaign insights and recommendations
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  Lightbulb,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { CampaignInsights } from '@/lib/services/ai-insights';
import { getCampaignInsights, regenerateCampaignInsights } from '@/lib/actions/ai-insights';

interface InsightsDashboardProps {
  campaignId: string;
  campaignName: string;
  initialInsights?: CampaignInsights | null;
}

export function InsightsDashboard({ 
  campaignId, 
  campaignName, 
  initialInsights 
}: InsightsDashboardProps) {
  const [insights, setInsights] = useState<CampaignInsights | null>(initialInsights || null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load insights if not provided initially
  useEffect(() => {
    if (!insights && !loading) {
      loadInsights();
    }
  }, [campaignId]);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getCampaignInsights(campaignId);
      if (result.success) {
        setInsights(result.insights || null);
      } else {
        setError(result.error || 'Failed to load insights');
      }
    } catch (err) {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('campaignId', campaignId);

      const result = await regenerateCampaignInsights(formData);
      if (result.success) {
        setInsights(result.insights || null);
      } else {
        setError(result.error || 'Failed to regenerate insights');
      }
    } catch (err) {
      setError('Failed to regenerate insights');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Campaign Insights
          </CardTitle>
          <CardDescription>Loading AI-powered analysis...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Campaign Insights
          </CardTitle>
          <CardDescription>Error loading insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button onClick={loadInsights} className="mt-4" variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Campaign Insights
          </CardTitle>
          <CardDescription>No insights available for this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            AI insights are generated automatically for completed campaigns. 
            This campaign may not be completed yet or insights generation may be in progress.
          </p>
          <Button onClick={loadInsights} variant="outline">
            Check Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getPerformanceBadgeVariant = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'average': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Campaign Insights
              </CardTitle>
              <CardDescription>
                AI-powered analysis for "{campaignName}"
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(insights.generatedAt).toLocaleDateString()}
              </div>
              <Button
                onClick={handleRegenerate}
                disabled={regenerating}
                variant="outline"
                size="sm"
              >
                {regenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                {insights.performanceAnalysis.keyMetrics.engagementScore}
              </div>
              <div className="text-sm text-muted-foreground">Engagement Score</div>
            </div>
            <div className="text-center">
              <Badge variant={getPerformanceBadgeVariant(insights.performanceAnalysis.overallPerformance)}>
                {insights.performanceAnalysis.overallPerformance.toUpperCase()}
              </Badge>
              <div className="text-sm text-muted-foreground mt-1">Overall Performance</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {insights.performanceAnalysis.benchmarkComparison.openRateVsAverage > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={insights.performanceAnalysis.benchmarkComparison.openRateVsAverage > 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(insights.performanceAnalysis.benchmarkComparison.openRateVsAverage).toFixed(1)}%
                </span>
              </div>
              <div className="text-sm text-muted-foreground">vs. Average</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {insights.executiveSummary}
          </p>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Open Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {insights.performanceAnalysis.keyMetrics.openRate}%
                    </span>
                  </div>
                  <Progress value={insights.performanceAnalysis.keyMetrics.openRate} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Click Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {insights.performanceAnalysis.keyMetrics.clickRate}%
                    </span>
                  </div>
                  <Progress value={insights.performanceAnalysis.keyMetrics.clickRate} className="h-2" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Benchmark Comparison</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Open Rate vs Average:</span>
                    <span className={insights.performanceAnalysis.benchmarkComparison.openRateVsAverage > 0 ? 'text-green-600' : 'text-red-600'}>
                      {insights.performanceAnalysis.benchmarkComparison.openRateVsAverage > 0 ? '+' : ''}
                      {insights.performanceAnalysis.benchmarkComparison.openRateVsAverage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Click Rate vs Average:</span>
                    <span className={insights.performanceAnalysis.benchmarkComparison.clickRateVsAverage > 0 ? 'text-green-600' : 'text-red-600'}>
                      {insights.performanceAnalysis.benchmarkComparison.clickRateVsAverage > 0 ? '+' : ''}
                      {insights.performanceAnalysis.benchmarkComparison.clickRateVsAverage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Subject Line Effectiveness</h4>
                <p className="text-sm text-muted-foreground">
                  {insights.contentAnalysis.subjectLineEffectiveness}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Content Engagement</h4>
                <p className="text-sm text-muted-foreground">
                  {insights.contentAnalysis.contentEngagement}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Top Performing Elements</h4>
                <ul className="space-y-1">
                  {insights.contentAnalysis.topPerformingElements.map((element, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {element}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Audience Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">High-Performing Segments</h4>
                <div className="space-y-2">
                  {insights.audienceInsights.highPerformingSegments.map((segment, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <div className="font-medium text-sm">{segment.segment}</div>
                        <div className="text-xs text-muted-foreground">{segment.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{segment.openRate.toFixed(1)}% open</div>
                        <div className="text-xs text-muted-foreground">{segment.clickRate.toFixed(1)}% click</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Engagement Patterns</h4>
                <ul className="space-y-1">
                  {insights.audienceInsights.engagementPatterns.map((pattern, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="h-3 w-3 text-blue-600" />
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4" />
                  Immediate Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.recommendations.immediate.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Long-term Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.recommendations.longTerm.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Target className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4" />
                  Content Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.recommendations.contentSuggestions.map((rec, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Lightbulb className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}