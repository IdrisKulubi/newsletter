# AI Service Integration

This module provides AI-powered features for the newsletter platform using OpenAI's GPT models via the Vercel AI SDK.

## Features

### 1. Content Generation
- Generate newsletter content from simple prompts
- Support for different content lengths (short, medium, long)
- Customizable tone and audience targeting
- Structured output with title, content, key points, and call-to-action

### 2. Subject Line Optimization
- Generate multiple subject line variations
- Performance predictions (high, medium, low)
- Tone analysis and reasoning for each variation
- Optimized for different campaign types

### 3. Tone and Style Adjustment
- Adjust existing content to match target tone
- Preserve core message while changing style
- Detailed change tracking and explanations
- Support for various tone combinations

### 4. Campaign Insights
- AI-powered post-campaign analysis
- Performance insights and recommendations
- Identification of high-performing elements
- Executive summary generation

## Usage

### Server Actions

```typescript
import { generateContentAction } from '@/lib/actions/ai/generate-content';
import { optimizeSubjectLinesAction } from '@/lib/actions/ai/optimize-subject-lines';
import { adjustToneAction } from '@/lib/actions/ai/adjust-tone';

// Generate content
const formData = new FormData();
formData.append('prompt', 'Create a newsletter about AI trends');
formData.append('tone', 'professional');
formData.append('length', 'medium');

const result = await generateContentAction(formData);
```

### Direct Service Usage

```typescript
import { aiService } from '@/lib/ai';

// Generate content programmatically
const content = await aiService.generateContent(
  'Create a newsletter about AI trends',
  {
    company: 'Tech Consulting',
    audience: 'Business leaders',
    tone: 'professional',
    length: 'medium'
  },
  'tenant-123'
);

// Optimize subject lines
const variations = await aiService.optimizeSubjectLines(
  'Newsletter content here...',
  {
    company: 'Tech Consulting',
    audience: 'Business leaders',
    campaign_type: 'Weekly Newsletter'
  },
  'tenant-123'
);
```

## Rate Limiting

The AI service implements built-in rate limiting to prevent abuse:

- **10 requests per minute** per tenant per feature type
- Separate limits for content generation, subject line optimization, etc.
- Automatic rate limit status tracking
- Graceful error handling when limits are exceeded

```typescript
// Check rate limit status
const status = aiService.getRateLimitStatus('tenant-123');
console.log(`Remaining requests: ${status.remaining}`);
console.log(`Reset time: ${new Date(status.resetTime)}`);
```

## Error Handling

The service provides comprehensive error handling:

```typescript
try {
  const content = await aiService.generateContent(prompt, context, tenantId);
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Handle rate limiting
  } else if (error.message.includes('Failed to generate')) {
    // Handle AI service errors
  }
}
```

## Health Monitoring

```typescript
import { checkAIHealth } from '@/lib/ai/health-check';

const health = await checkAIHealth('tenant-123');
if (health.isHealthy) {
  console.log('AI service is operational');
} else {
  console.error('AI service issue:', health.error);
}
```

## Configuration

The AI service uses the following environment variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Configuration is managed through `@/lib/config`:

```typescript
import { config } from '@/lib/config';

// AI configuration is available at:
config.ai.openaiApiKey
```

## Testing

The module includes comprehensive test coverage:

- **Unit tests**: `src/__tests__/unit/ai.test.ts`
- **Integration tests**: `src/__tests__/integration/ai-actions.test.ts`

Run tests:
```bash
pnpm test:run ai
```

## Data Models

### Content Generation Response
```typescript
interface ContentGeneration {
  title: string;
  content: string;
  tone: string;
  key_points: string[];
  call_to_action?: string;
}
```

### Subject Line Variation
```typescript
interface SubjectLineVariation {
  text: string;
  tone: 'professional' | 'casual' | 'urgent' | 'friendly' | 'formal';
  predicted_performance: 'high' | 'medium' | 'low';
  reasoning: string;
}
```

### Tone Adjustment Response
```typescript
interface ToneAdjustment {
  adjusted_content: string;
  changes_made: string[];
  tone_achieved: string;
}
```

## Security Considerations

- All AI requests are tenant-scoped for data isolation
- Rate limiting prevents abuse and controls costs
- Input validation using Zod schemas
- Error messages don't expose sensitive information
- API keys are securely managed through environment variables

## Performance Optimization

- Response caching for frequently requested content
- Optimized prompt engineering for faster responses
- Batch processing capabilities for multiple requests
- Health check caching to reduce unnecessary API calls

## Future Enhancements

- Support for additional AI models (Claude, Gemini)
- Advanced personalization based on subscriber data
- A/B testing integration for subject lines
- Multi-language content generation
- Image generation for newsletter assets