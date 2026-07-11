-- One-time cleanup: negative-cache rows were written under buggy logic that
-- treated timeouts / HTTP / CKAN errors as definitive "plate absent" misses.
-- Clear all so valid plates (e.g. 54319404) are re-probed against data.gov.il.

DELETE FROM public.vehicle_lookup_misses;
