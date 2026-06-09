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

// Must match each service's default *_PORT (see apps/services/*/src/index.ts),
// because the container health check + ALB target group use this port.
export const SERVICE_PORTS: Record<ServiceName, number> = {
  'auth-service':         3000,
  'user-service':         3001,
  'tweet-service':        3002,
  'feed-service':         3003,
  'notification-service': 3004,
  'search-service':       3005,
  'media-service':        3006,
  'fanout-service':       3007,
};

/** Default Fargate task sizes per service. Override per environment via context. */
export const FARGATE_DEFAULTS = {
  cpu:    256,   // 0.25 vCPU
  memory: 512,   // 0.5 GB
  desiredCount: 1,
} as const;

// tweet.created fans out (fanout + search) via an SNS topic with two SQS
// subscriptions. tweet.liked / user.followed are 1:1 SQS queues.
export const SNS_TOPICS = {
  TWEET_CREATED: 'xcloud-tweet-created',
} as const;

export const SQS_QUEUES = {
  FANOUT:       'xcloud-fanout',        // subscribes to tweet.created (SNS)
  TWEET_INDEX:  'xcloud-tweet-index',   // subscribes to tweet.created (SNS)
  LIKE_EVENT:   'xcloud-like-event',    // tweet.liked  (tweet -> notification)
  FOLLOW_EVENT: 'xcloud-follow-event',  // user.followed (user -> notification)
} as const;

export const APP_PREFIX = 'xcloud';
