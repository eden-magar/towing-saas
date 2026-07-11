-- Make tow-images PRIVATE and allow authenticated access only for users
-- who can access the related tow (company staff / assigned driver / portal customer).
-- Path layout: {tow_id}/{filename}
--
-- RUN THIS IN SUPABASE SQL EDITOR after deploying signed-URL client code.
-- Order: (1) deploy app that uses createSignedUrl, (2) run this SQL.

UPDATE storage.buckets
SET public = false
WHERE id = 'tow-images';

-- Drop prior policies if re-running (safe if missing).
DROP POLICY IF EXISTS "tow_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "tow_images_authenticated_all" ON storage.objects;
DROP POLICY IF EXISTS "tow_images_select_authorized" ON storage.objects;
DROP POLICY IF EXISTS "tow_images_insert_authorized" ON storage.objects;
DROP POLICY IF EXISTS "tow_images_update_authorized" ON storage.objects;
DROP POLICY IF EXISTS "tow_images_delete_authorized" ON storage.objects;

CREATE POLICY "tow_images_select_authorized"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tow-images'
  AND EXISTS (
    SELECT 1
    FROM public.tows t
    INNER JOIN public.users u ON u.id = auth.uid()
    LEFT JOIN public.customers c ON c.id = t.customer_id
    WHERE t.id::text = split_part(name, '/', 1)
      AND u.is_active = true
      AND (
        -- Company staff (same company)
        (
          u.role IN (
            'company_admin'::public.user_role,
            'dispatcher'::public.user_role,
            'super_admin'::public.user_role
          )
          AND (u.role = 'super_admin'::public.user_role OR u.company_id = t.company_id)
        )
        -- Assigned driver
        OR (
          u.role = 'driver'::public.user_role
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.user_id = u.id AND d.id = t.driver_id
          )
        )
        -- Portal customer: own tow AND show_photos resolves true
        OR (
          u.role = 'customer'::public.user_role
          AND t.customer_id = public.get_my_customer_id()
          AND (
            CASE
              WHEN t.show_photos_override IS NOT NULL THEN t.show_photos_override
              WHEN jsonb_typeof(t.visibility_overrides->'show_photos') = 'boolean'
                THEN (t.visibility_overrides->>'show_photos')::boolean
              ELSE (c.portal_settings->>'show_photos') = 'true'
            END
          )
        )
      )
  )
);

CREATE POLICY "tow_images_insert_authorized"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tow-images'
  AND EXISTS (
    SELECT 1
    FROM public.tows t
    INNER JOIN public.users u ON u.id = auth.uid()
    WHERE t.id::text = split_part(name, '/', 1)
      AND u.is_active = true
      AND (
        (
          u.role IN (
            'company_admin'::public.user_role,
            'dispatcher'::public.user_role,
            'super_admin'::public.user_role
          )
          AND (u.role = 'super_admin'::public.user_role OR u.company_id = t.company_id)
        )
        OR (
          u.role = 'driver'::public.user_role
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.user_id = u.id AND d.id = t.driver_id
          )
        )
      )
  )
);

CREATE POLICY "tow_images_update_authorized"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tow-images'
  AND EXISTS (
    SELECT 1
    FROM public.tows t
    INNER JOIN public.users u ON u.id = auth.uid()
    WHERE t.id::text = split_part(name, '/', 1)
      AND u.is_active = true
      AND (
        (
          u.role IN (
            'company_admin'::public.user_role,
            'dispatcher'::public.user_role,
            'super_admin'::public.user_role
          )
          AND (u.role = 'super_admin'::public.user_role OR u.company_id = t.company_id)
        )
        OR (
          u.role = 'driver'::public.user_role
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.user_id = u.id AND d.id = t.driver_id
          )
        )
      )
  )
);

CREATE POLICY "tow_images_delete_authorized"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tow-images'
  AND EXISTS (
    SELECT 1
    FROM public.tows t
    INNER JOIN public.users u ON u.id = auth.uid()
    WHERE t.id::text = split_part(name, '/', 1)
      AND u.is_active = true
      AND (
        (
          u.role IN (
            'company_admin'::public.user_role,
            'dispatcher'::public.user_role,
            'super_admin'::public.user_role
          )
          AND (u.role = 'super_admin'::public.user_role OR u.company_id = t.company_id)
        )
        OR (
          u.role = 'driver'::public.user_role
          AND EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.user_id = u.id AND d.id = t.driver_id
          )
        )
      )
  )
);
