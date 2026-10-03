-- Access control. Privileges are granted explicitly (nothing blanket), then RLS narrows rows.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ─── Function privileges ─────────────────────────────────────────────────
-- Helpers evaluated inside policies / constraints must be executable by API roles.
grant execute on function
  public.is_admin(), public.role_rank(public.business_role), public.has_business_role(uuid, public.business_role),
  public.member_has_role(uuid, uuid, public.business_role), public.is_business_public(uuid), public.is_booking_party(uuid),
  public.blocking_statuses(), public.is_reserved_slug(text), public.slugify(text), public.try_uuid(text),
  public.plan_vehicle_limit(public.subscription_plan), public.generate_booking_reference()
to anon, authenticated;

-- Public RPCs
grant execute on function
  public.is_slug_available(text), public.get_public_payment_methods(uuid),
  public.vehicle_unavailable_ranges(uuid, timestamptz, timestamptz),
  public.quote_booking(uuid, timestamptz, timestamptz, boolean, boolean),
  public.business_public_stats(uuid[]), public.public_reviews(uuid, uuid, int),
  public.search_vehicles(text[], text, text, public.transmission_type, int, numeric, numeric, boolean, boolean, boolean, numeric, uuid, timestamptz, timestamptz, text, int, int),
  public.track_view(uuid, uuid, text)
to anon, authenticated;

-- Signed-in RPCs (each re-checks authorization internally)
grant execute on function
  public.register_business(text, text, text, text, text, text, text, text, text, text, text, text),
  public.submit_business_verification(uuid, jsonb, text),
  public.admin_review_business(uuid, public.business_status, text),
  public.set_storefront_published(uuid, boolean),
  public.add_business_member(uuid, text, public.business_role),
  public.remove_business_member(uuid, uuid),
  public.admin_set_plan(uuid, public.subscription_plan, public.subscription_status),
  public.save_vehicle(uuid, uuid, jsonb, jsonb),
  public.archive_vehicle(uuid),
  public.start_conversation(uuid, uuid, text),
  public.mark_conversation_read(uuid),
  public.request_booking(uuid, timestamptz, timestamptz, text, text, public.payment_method_type, boolean, boolean, int, text),
  public.propose_booking(uuid, uuid, timestamptz, timestamptz, text, text, boolean, boolean, text),
  public.transition_booking(uuid, public.booking_status, text),
  public.accept_booking_proposal(uuid, public.payment_method_type),
  public.regenerate_contract(uuid),
  public.update_booking_terms(uuid, timestamptz, timestamptz, text, text, numeric, numeric, numeric),
  public.mark_contract_viewed(uuid),
  public.admin_save_contract_template(text, jsonb),
  public.create_review(uuid, int, int, int, text),
  public.respond_to_review(uuid, text),
  public.admin_set_review_hidden(uuid, boolean),
  public.admin_resolve_report(uuid, public.report_status, text),
  public.admin_set_user_suspended(uuid, boolean),
  public.admin_set_kyc_status(uuid, public.kyc_status, text),
  public.request_account_deletion(),
  public.admin_anonymize_user(uuid),
  public.business_analytics(uuid, int),
  public.admin_overview(),
  public.is_vehicle_available(uuid, timestamptz, timestamptz, uuid)
to authenticated;

-- Server-only (secret key): signatures capture request IP/UA; PDF attachment.
grant execute on function
  public.send_contract(uuid, uuid, text, inet, text),
  public.sign_contract(uuid, uuid, public.signature_type, text, text, text, boolean, inet, text),
  public.attach_contract_pdf(uuid, text, text),
  public.expire_stale_bookings()
to service_role;

-- ─── Table privileges ────────────────────────────────────────────────────
grant select on public.businesses, public.business_storefronts, public.vehicle_categories, public.vehicles,
  public.vehicle_pricing, public.vehicle_images, public.reviews, public.platform_settings
to anon;

grant select on all tables in schema public to authenticated;
revoke select on public.booking_transitions from anon;

grant update (full_name, phone, avatar_path, marketing_opt_in, terms_accepted_at) on public.profiles to authenticated;
grant insert (user_id), update (legal_name, date_of_birth, address, city, license_number, license_expiry) on public.renters to authenticated;
grant insert (user_id, doc_type, storage_path), delete on public.driver_documents to authenticated;
grant update (name, description, address, city, province, phone, email, representative_name, representative_title,
  registration_type, registration_number, logo_path) on public.businesses to authenticated;
grant update (tagline, about, cover_path, accent_color, business_hours, social_links, pickup_locations, delivery_areas,
  featured_vehicle_ids, faqs, policies, hidden_sections) on public.business_storefronts to authenticated;
grant insert (business_id, method, account_name, account_number, instructions, is_enabled),
  update (account_name, account_number, instructions, is_enabled), delete on public.payment_methods to authenticated;
grant insert, update, delete on public.vehicle_categories to authenticated;
grant insert (business_id, slug, make, model, variant, year, category_slug, transmission, fuel_type, seats, color, plate_number,
  description, status, self_drive, with_driver, delivery_available, pickup_location, city, min_rental_days),
  update (make, model, variant, year, category_slug, transmission, fuel_type, seats, color, plate_number, description, status,
  self_drive, with_driver, delivery_available, pickup_location, city, min_rental_days) on public.vehicles to authenticated;
grant insert, update on public.vehicle_pricing to authenticated;
grant insert (vehicle_id, business_id, storage_path, position, width, height), update (position), delete on public.vehicle_images to authenticated;
grant insert (vehicle_id, starts_at, ends_at, reason, note, created_by), update (starts_at, ends_at, reason, note), delete
  on public.vehicle_blocked_dates to authenticated;
grant insert (user_id, vehicle_id), delete on public.favorites to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;
grant update (payment_status) on public.bookings to authenticated;
grant insert (booking_id, amount, method, reference, note, paid_at), delete on public.payments to authenticated;
grant update (read_at), delete on public.notifications to authenticated;
grant insert (entity_type, entity_id, reason, details) on public.reports to authenticated;
grant update (value, updated_by) , insert on public.platform_settings to authenticated;
grant insert, update, delete on public.gps_integrations, public.gps_devices to authenticated;

-- ─── Policies ─────────────────────────────────────────────────────────────
-- profiles
create policy "profiles: self, admin, related businesses, teammates" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or public.is_admin()
  or exists (select 1 from public.bookings b where b.renter_id = profiles.id and public.has_business_role(b.business_id))
  or exists (select 1 from public.conversations c where c.customer_id = profiles.id and public.has_business_role(c.business_id))
  or exists (select 1 from public.business_members m where m.user_id = profiles.id and public.has_business_role(m.business_id))
);
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- renters (KYC details): self, admin, businesses with a booking from this renter
create policy "renters: read" on public.renters for select to authenticated using (
  user_id = (select auth.uid()) or public.is_admin()
  or exists (select 1 from public.bookings b where b.renter_id = renters.user_id and public.has_business_role(b.business_id))
);
create policy "renters: insert self" on public.renters for insert to authenticated with check (user_id = (select auth.uid()));
create policy "renters: update self" on public.renters for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- driver documents: metadata only; files are in the private kyc bucket
create policy "driver_documents: read" on public.driver_documents for select to authenticated using (
  user_id = (select auth.uid()) or public.is_admin()
  or exists (select 1 from public.bookings b where b.renter_id = driver_documents.user_id and public.has_business_role(b.business_id)
             and b.status in ('APPROVED','CONTRACT_DRAFT','CONTRACT_SENT','AWAITING_SIGNATURE','SIGNED','CONFIRMED','ACTIVE','RETURNED'))
);
create policy "driver_documents: insert self" on public.driver_documents for insert to authenticated
  with check (user_id = (select auth.uid()) and storage_path like (select auth.uid())::text || '/%');
create policy "driver_documents: delete self" on public.driver_documents for delete to authenticated using (user_id = (select auth.uid()));

-- businesses
create policy "businesses: public or related" on public.businesses for select to anon, authenticated using (
  public.is_business_public(id) or public.has_business_role(id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.business_id = businesses.id and b.renter_id = (select auth.uid()))
  or exists (select 1 from public.conversations c where c.business_id = businesses.id and c.customer_id = (select auth.uid()))
);
create policy "businesses: managers update" on public.businesses for update to authenticated
  using (public.has_business_role(id, 'MANAGER')) with check (public.has_business_role(id, 'MANAGER'));

create policy "business_members: read" on public.business_members for select to authenticated using (
  user_id = (select auth.uid()) or public.has_business_role(business_id) or public.is_admin()
);

create policy "storefronts: public or members" on public.business_storefronts for select to anon, authenticated using (
  public.is_business_public(business_id) or public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.business_id = business_storefronts.business_id and b.renter_id = (select auth.uid()))
);
create policy "storefronts: managers update" on public.business_storefronts for update to authenticated
  using (public.has_business_role(business_id, 'MANAGER')) with check (public.has_business_role(business_id, 'MANAGER'));

create policy "verifications: owner or admin" on public.business_verifications for select to authenticated using (
  public.has_business_role(business_id, 'OWNER') or public.is_admin()
);

create policy "payment_methods: read" on public.payment_methods for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.business_id = payment_methods.business_id and b.renter_id = (select auth.uid()))
);
create policy "payment_methods: owner insert" on public.payment_methods for insert to authenticated
  with check (public.has_business_role(business_id, 'OWNER'));
create policy "payment_methods: owner update" on public.payment_methods for update to authenticated
  using (public.has_business_role(business_id, 'OWNER')) with check (public.has_business_role(business_id, 'OWNER'));
create policy "payment_methods: owner delete" on public.payment_methods for delete to authenticated
  using (public.has_business_role(business_id, 'OWNER'));

create policy "subscriptions: members or admin" on public.subscriptions for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
);

-- vehicle categories
create policy "categories: read" on public.vehicle_categories for select to anon, authenticated using (true);
create policy "categories: admin insert" on public.vehicle_categories for insert to authenticated with check (public.is_admin());
create policy "categories: admin update" on public.vehicle_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: admin delete" on public.vehicle_categories for delete to authenticated using (public.is_admin());

-- vehicles
create policy "vehicles: public or related" on public.vehicles for select to anon, authenticated using (
  (deleted_at is null and status = 'ACTIVE' and public.is_business_public(business_id))
  or public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.vehicle_id = vehicles.id and b.renter_id = (select auth.uid()))
  or exists (select 1 from public.favorites f where f.vehicle_id = vehicles.id and f.user_id = (select auth.uid()))
);
create policy "vehicles: managers insert" on public.vehicles for insert to authenticated
  with check (public.has_business_role(business_id, 'MANAGER'));
create policy "vehicles: managers update" on public.vehicles for update to authenticated
  using (public.has_business_role(business_id, 'MANAGER')) with check (public.has_business_role(business_id, 'MANAGER'));

create policy "pricing: visible with vehicle" on public.vehicle_pricing for select to anon, authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_pricing.vehicle_id)
);
create policy "pricing: managers insert" on public.vehicle_pricing for insert to authenticated with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_pricing.vehicle_id and public.has_business_role(v.business_id, 'MANAGER'))
);
create policy "pricing: managers update" on public.vehicle_pricing for update to authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_pricing.vehicle_id and public.has_business_role(v.business_id, 'MANAGER'))
);

create policy "images: visible with vehicle" on public.vehicle_images for select to anon, authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_images.vehicle_id)
);
create policy "images: managers insert" on public.vehicle_images for insert to authenticated with check (
  public.has_business_role(business_id, 'MANAGER')
  and exists (select 1 from public.vehicles v where v.id = vehicle_images.vehicle_id and v.business_id = vehicle_images.business_id)
  and storage_path like 'b/' || business_id::text || '/%'
);
create policy "images: managers update" on public.vehicle_images for update to authenticated using (public.has_business_role(business_id, 'MANAGER'));
create policy "images: managers delete" on public.vehicle_images for delete to authenticated using (public.has_business_role(business_id, 'MANAGER'));

create policy "blocks: members read" on public.vehicle_blocked_dates for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
);
create policy "blocks: members insert" on public.vehicle_blocked_dates for insert to authenticated with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_blocked_dates.vehicle_id and public.has_business_role(v.business_id))
);
create policy "blocks: members update" on public.vehicle_blocked_dates for update to authenticated using (public.has_business_role(business_id));
create policy "blocks: members delete" on public.vehicle_blocked_dates for delete to authenticated using (public.has_business_role(business_id));

create policy "favorites: own" on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "favorites: own insert" on public.favorites for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorites: own delete" on public.favorites for delete to authenticated using (user_id = (select auth.uid()));

-- conversations & messages
create policy "conversations: parties" on public.conversations for select to authenticated using (
  customer_id = (select auth.uid()) or public.has_business_role(business_id) or public.is_admin()
);
create policy "messages: parties read" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id)
);
create policy "messages: parties send" on public.messages for insert to authenticated with check (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id
          and (c.customer_id = (select auth.uid()) or public.has_business_role(c.business_id)))
  and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_suspended)
);

-- bookings
create policy "bookings: parties" on public.bookings for select to authenticated using (
  renter_id = (select auth.uid()) or public.has_business_role(business_id) or public.is_admin()
);
create policy "bookings: staff update payment status" on public.bookings for update to authenticated
  using (public.has_business_role(business_id)) with check (public.has_business_role(business_id));

create policy "booking history: parties" on public.booking_status_history for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_status_history.booking_id)
);
create policy "transitions: read" on public.booking_transitions for select to authenticated using (true);

create policy "payments: parties" on public.payments for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.id = payments.booking_id and b.renter_id = (select auth.uid()))
);
create policy "payments: staff record" on public.payments for insert to authenticated with check (
  exists (select 1 from public.bookings b where b.id = payments.booking_id and public.has_business_role(b.business_id))
);
create policy "payments: managers delete" on public.payments for delete to authenticated using (public.has_business_role(business_id, 'MANAGER'));

-- contracts
create policy "templates: read" on public.contract_templates for select to authenticated using (true);
create policy "contracts: parties" on public.contracts for select to authenticated using (
  renter_id = (select auth.uid()) or public.has_business_role(business_id) or public.is_admin()
);
create policy "contract versions: business sees all, renter sees sent" on public.contract_versions for select to authenticated using (
  exists (select 1 from public.contracts c where c.id = contract_versions.contract_id
          and (public.has_business_role(c.business_id) or public.is_admin()
               or (c.renter_id = (select auth.uid()) and contract_versions.sent_at is not null)))
);
create policy "signatures: parties" on public.contract_signatures for select to authenticated using (
  exists (select 1 from public.contract_versions v where v.id = contract_signatures.contract_version_id)
);

-- reviews (public unless hidden)
create policy "reviews: public" on public.reviews for select to anon, authenticated using (
  (not is_hidden and public.is_business_public(business_id))
  or renter_id = (select auth.uid()) or public.has_business_role(business_id) or public.is_admin()
);

-- notifications
create policy "notifications: own" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: own update" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: own delete" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- audit, reports, analytics, settings
create policy "audit: admin or owners" on public.audit_logs for select to authenticated using (
  public.is_admin() or (business_id is not null and public.has_business_role(business_id, 'OWNER'))
);
create policy "reports: own or admin" on public.reports for select to authenticated using (
  reporter_id = (select auth.uid()) or public.is_admin()
);
create policy "reports: create" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "page_views: members" on public.page_views for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
);
create policy "settings: read" on public.platform_settings for select to anon, authenticated using (true);
create policy "settings: admin insert" on public.platform_settings for insert to authenticated with check (public.is_admin());
create policy "settings: admin update" on public.platform_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- GPS (future)
create policy "gps integrations: managers" on public.gps_integrations for all to authenticated
  using (public.has_business_role(business_id, 'MANAGER')) with check (public.has_business_role(business_id, 'MANAGER'));
create policy "gps devices: managers" on public.gps_devices for all to authenticated
  using (public.has_business_role(business_id, 'MANAGER')) with check (public.has_business_role(business_id, 'MANAGER'));
create policy "gps events: members" on public.gps_events for select to authenticated using (public.has_business_role(business_id));
