export const SERVICES = [
  'auth-service',
  'user-service',
  'tweet-service',
  'feed-service',
  'fanout-service',
  'media-service',
  'notification-service',
  'search-service',
] as const;

export type ServiceName = typeof SERVICES[number];

export const SERVICE_PORTS: Record<ServiceName, number> = {
  'auth-service':         3001,
  'user-service':         3002,
  'tweet-service':        3003,
  'feed-service':         3004,
  'fanout-service':       3005,
  'media-service':        3006,
  'notification-service': 3007,
  'search-service':       3008,
};

/** Default Fargate task sizes per service. Override per environment via context. */
export const FARGATE_DEFAULTS = {
  cpu:    256,   // 0.25 vCPU
  memory: 512,   // 0.5 GB
  desiredCount: 1,
} as const;

export const SQS_QUEUES = {
  TWEET_CREATED: 'xcloud-tweet-created',
  LIKE_EVENT:    'xcloud-like-event',
  FOLLOW_EVENT:  'xcloud-follow-event',
  TWEET_INDEX:   'xcloud-tweet-index',
} as const;

export const APP_PREFIX = 'xcloud';
