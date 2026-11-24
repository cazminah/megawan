-- duration went from 5 notches (30m, 1h, 2–3h, half day, all day) to 3 (a bit, few hours, all day).
-- 30m, 1h → a bit (0) · 2–3h → few hours (1) · half day, all day → all day (2)
UPDATE `interests` SET
  `duration_min` = CASE WHEN `duration_min` <= 1 THEN 0 WHEN `duration_min` = 2 THEN 1 ELSE 2 END,
  `duration_max` = CASE WHEN `duration_max` <= 1 THEN 0 WHEN `duration_max` = 2 THEN 1 ELSE 2 END
WHERE `duration_min` IS NOT NULL;
