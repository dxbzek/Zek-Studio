-- Expand generated_content.type to allow content theme values

ALTER TABLE generated_content
  DROP CONSTRAINT IF EXISTS generated_content_type_check;

ALTER TABLE generated_content
  ADD CONSTRAINT generated_content_type_check
    CHECK (type IN (
      'hook','caption','idea','script','listing','market','story','cta',
      'property_tour','market_update','agent_recruitment','client_story',
      'investment_tips','behind_scenes','new_launch','area_spotlight'
    ));
