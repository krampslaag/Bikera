import { pgTable, text, serial, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Existing tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userRelations = relations(users, ({ many }) => ({
  followers: many(follows, { relationName: "follower" }),
  following: many(follows, { relationName: "following" }),
  activities: many(activities),
  minerStats: many(minerStats)
}));

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id),
  followingId: integer("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // e.g., 'block_mined', 'achievement_earned', 'level_up'
  data: text("data"), // JSON string containing activity-specific data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// Enhanced miner statistics table
export const minerStats = pgTable("miner_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  totalBlocksMined: integer("total_blocks_mined").notNull().default(0),
  totalRewards: decimal("total_rewards").notNull().default("0"),
  totalDistance: decimal("total_distance").notNull().default("0"),
  weeklyBlocksMined: integer("weekly_blocks_mined").notNull().default(0),
  weeklyRewards: decimal("weekly_rewards").notNull().default("0"),
  weeklyDistance: decimal("weekly_distance").notNull().default("0"),
  lastMined: timestamp("last_mined"),
  rank: integer("rank"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const minerStatsRelations = relations(minerStats, ({ one }) => ({
  user: one(users, {
    fields: [minerStats.userId],
    references: [users.id],
  }),
}));

// Existing tables remain unchanged
export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull(),
  hash: text("hash").notNull(),
  previousHash: text("previous_hash").notNull(),
  targetDistance: decimal("target_distance"),
  travelDistance: decimal("travel_distance"),
  winnerId: integer("winner_id"),
  minerAddress: text("miner_address"),
  reward: decimal("reward")
});

export const miningRewards = pgTable("mining_rewards", {
  id: serial("id").primaryKey(),
  minerAddress: text("miner_address").notNull(),
  totalRewards: decimal("total_rewards").notNull().default("0"),
  lastUpdated: timestamp("last_updated").notNull()
});

export const competitionStatus = pgTable("competition_status", {
  id: serial("id").primaryKey(),
  isActive: boolean("is_active").notNull().default(false),
  startTime: timestamp("start_time"),
  targetDistance: decimal("target_distance"),
  participants: integer("participants").notNull().default(0)
});

// Schema types
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const insertMinerStatsSchema = createInsertSchema(minerStats);
export const selectMinerStatsSchema = createSelectSchema(minerStats);
export type InsertMinerStats = typeof minerStats.$inferInsert;
export type SelectMinerStats = typeof minerStats.$inferSelect;

export const insertFollowSchema = createInsertSchema(follows);
export const selectFollowSchema = createSelectSchema(follows);
export type InsertFollow = typeof follows.$inferInsert;
export type SelectFollow = typeof follows.$inferSelect;

export const insertActivitySchema = createInsertSchema(activities);
export const selectActivitySchema = createSelectSchema(activities);
export type InsertActivity = typeof activities.$inferInsert;
export type SelectActivity = typeof activities.$inferSelect;

// Existing schema types remain unchanged
export const insertBlockSchema = createInsertSchema(blocks);
export const selectBlockSchema = createSelectSchema(blocks);
export type InsertBlock = typeof blocks.$inferInsert;
export type SelectBlock = typeof blocks.$inferSelect;

export const insertMiningRewardSchema = createInsertSchema(miningRewards);
export const selectMiningRewardSchema = createSelectSchema(miningRewards);
export type InsertMiningReward = typeof miningRewards.$inferInsert;
export type SelectMiningReward = typeof miningRewards.$inferSelect;

export const insertCompetitionStatusSchema = createInsertSchema(competitionStatus);
export const selectCompetitionStatusSchema = createSelectSchema(competitionStatus);
export type InsertCompetitionStatus = typeof competitionStatus.$inferInsert;
export type SelectCompetitionStatus = typeof competitionStatus.$inferSelect;