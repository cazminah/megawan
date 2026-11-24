import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(), // stored lowercased
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar").notNull(), // json Avatar
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha-256 of the cookie token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const resetTokens = sqliteTable("reset_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const games = sqliteTable("games", {
  igdbId: integer("igdb_id").primaryKey(),
  data: text("data").notNull(), // json Game — the arcade only ever reads whole rows
  fetchedAt: integer("fetched_at").notNull(),
  addedAt: integer("added_at").notNull(),
});

export const interests = sqliteTable(
  "interests",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.igdbId, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    // optional "how long am i up for": indexes into DURATIONS (shared/types.ts), min <= max
    durationMin: integer("duration_min"),
    durationMax: integer("duration_max"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] }), index("interests_game_idx").on(t.gameId)],
);

// tiny key/value table — holds the cached IGDB access token
export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at"),
});
