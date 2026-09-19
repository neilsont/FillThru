-- Card-free 7-day trial + plan interval.
-- A row is created lazily (service role) the first time a signed-in user hits an
-- entitled endpoint; status = 'trialing' until trial_ends_at, then 'inactive'
-- unless Stripe has activated a subscription.
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_interval text CHECK (plan_interval IN ('month', 'year'));

CREATE INDEX IF NOT EXISTS user_subscriptions_trial_ends_at_idx
  ON user_subscriptions (trial_ends_at);
