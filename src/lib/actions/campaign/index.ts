/**
 * Campaign Actions
 * Centralized exports for all campaign-related server actions
 */

// CRUD Operations
export { createCampaign, type CreateCampaignData, type CreateCampaignResult } from './create-campaign';
export { updateCampaign, type UpdateCampaignData, type UpdateCampaignResult } from './update-campaign';
export { deleteCampaign, type DeleteCampaignResult } from './delete-campaign';
export { 
  getCampaigns, 
  getCampaignById, 
  getCampaignStats,
  type GetCampaignsParams,
  type CampaignWithDetails,
  type GetCampaignsResult 
} from './get-campaigns';

// Scheduling Operations
export { 
  scheduleCampaign, 
  unscheduleCampaign, 
  rescheduleCampaign,
  getUpcomingCampaigns,
  type ScheduleCampaignData,
  type ScheduleCampaignResult 
} from './schedule-campaign';

// Email Sending Operations
export { 
  sendCampaign, 
  processCampaignSending, 
  cancelCampaign,
  type SendCampaignData,
  type SendCampaignResult 
} from '../email/send-campaign';

// Retry Operations
export { 
  retryCampaign, 
  retryFailedBatches,
  getCampaignRetryHistory,
  checkRetryEligibility,
  type RetryCampaignResult 
} from './retry-campaign';

// Validation Schemas
export { createCampaignSchema } from './create-campaign';
export { updateCampaignSchema } from './update-campaign';
export { getCampaignsSchema } from './get-campaigns';
export { scheduleCampaignSchema } from './schedule-campaign';