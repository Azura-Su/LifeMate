-- Keep the two remaining Pixel Pet functions independent of caller search paths.
ALTER FUNCTION public.lifemate_pet_species_closed() SET search_path = '';
ALTER FUNCTION public.lifemate_pet_today() SET search_path = '';
