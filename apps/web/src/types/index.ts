// Core data types used across the app

export interface User {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

export interface Tweet {
  tweetId: string;
  content: string;
  author: User;
  mediaUrls: string[];
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  createdAt: string;
  replyToTweetId: string | null;
  liked: boolean;
  retweeted: boolean;
}