-- interest scale went from 3 tiers to 5. map old votes onto the closest new tier:
-- 1 (if nothing better's on) → 1 (eh, sure) · 2 (keen) → 3 (keen) · 3 (perish) → 5 (LET'S GO)
UPDATE `interests` SET `level` = CASE `level` WHEN 3 THEN 5 WHEN 2 THEN 3 ELSE `level` END;
