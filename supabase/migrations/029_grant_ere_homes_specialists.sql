-- Grant karimm@erehomes.ae and mustafa@erehomes.ae specialist access to
-- the ERE Homes brand. Once they sign up with these exact emails,
-- useSpecialistBrand matches by email and grants brand access. If they
-- already have accounts they'll see the brand on next refresh.
--
-- Scoped to ERE Homes ONLY — Abdul Kadir Faizal brand is never touched.
-- Idempotent via the unique(brand_id, email) constraint.

insert into public.team_members (brand_id, email, role)
select bp.id, lower(e.email), 'specialist'
from public.brand_profiles bp,
     (values ('karimm@erehomes.ae'), ('mustafa@erehomes.ae')) as e(email)
where bp.name ilike 'ERE Homes'
on conflict (brand_id, email) do nothing;
