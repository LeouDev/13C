-- Reference data: categories, the booking state machine, the default contract template, settings, realtime, cron.

insert into public.vehicle_categories (slug, label, sort_order) values
  ('sedan', 'Sedan', 1), ('hatchback', 'Hatchback', 2), ('suv', 'SUV', 3), ('mpv', 'MPV', 4),
  ('van', 'Van', 5), ('pickup', 'Pickup', 6), ('luxury', 'Luxury', 7)
on conflict (slug) do nothing;

-- Keep in sync with src/lib/bookings/status.ts (tests/state-machine.test.ts compares them).
insert into public.booking_transitions (from_status, to_status, actor) values
  ('INQUIRY', 'NEGOTIATING', 'SYSTEM'),
  ('INQUIRY', 'BOOKING_REQUESTED', 'BUSINESS'),
  ('INQUIRY', 'PENDING_OWNER_APPROVAL', 'RENTER'),
  ('INQUIRY', 'CANCELLED', 'RENTER'), ('INQUIRY', 'CANCELLED', 'BUSINESS'),
  ('INQUIRY', 'EXPIRED', 'SYSTEM'),
  ('NEGOTIATING', 'BOOKING_REQUESTED', 'BUSINESS'),
  ('NEGOTIATING', 'PENDING_OWNER_APPROVAL', 'RENTER'),
  ('NEGOTIATING', 'CANCELLED', 'RENTER'), ('NEGOTIATING', 'CANCELLED', 'BUSINESS'),
  ('NEGOTIATING', 'EXPIRED', 'SYSTEM'),
  ('BOOKING_REQUESTED', 'APPROVED', 'RENTER'),
  ('BOOKING_REQUESTED', 'CANCELLED', 'RENTER'), ('BOOKING_REQUESTED', 'CANCELLED', 'BUSINESS'),
  ('BOOKING_REQUESTED', 'EXPIRED', 'SYSTEM'),
  ('PENDING_OWNER_APPROVAL', 'APPROVED', 'BUSINESS'),
  ('PENDING_OWNER_APPROVAL', 'REJECTED', 'BUSINESS'),
  ('PENDING_OWNER_APPROVAL', 'CANCELLED', 'RENTER'),
  ('PENDING_OWNER_APPROVAL', 'EXPIRED', 'SYSTEM'),
  ('APPROVED', 'CONTRACT_DRAFT', 'SYSTEM'),
  ('APPROVED', 'CANCELLED', 'RENTER'), ('APPROVED', 'CANCELLED', 'BUSINESS'),
  ('CONTRACT_DRAFT', 'CONTRACT_SENT', 'SYSTEM'),
  ('CONTRACT_DRAFT', 'CANCELLED', 'RENTER'), ('CONTRACT_DRAFT', 'CANCELLED', 'BUSINESS'),
  ('CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SYSTEM'),
  ('CONTRACT_SENT', 'SIGNED', 'SYSTEM'),
  ('CONTRACT_SENT', 'CONTRACT_DRAFT', 'SYSTEM'),
  ('CONTRACT_SENT', 'CANCELLED', 'RENTER'), ('CONTRACT_SENT', 'CANCELLED', 'BUSINESS'),
  ('AWAITING_SIGNATURE', 'SIGNED', 'SYSTEM'),
  ('AWAITING_SIGNATURE', 'CONTRACT_DRAFT', 'SYSTEM'),
  ('AWAITING_SIGNATURE', 'CANCELLED', 'RENTER'), ('AWAITING_SIGNATURE', 'CANCELLED', 'BUSINESS'),
  ('SIGNED', 'CONFIRMED', 'SYSTEM'),
  ('SIGNED', 'CONTRACT_DRAFT', 'SYSTEM'),
  ('SIGNED', 'CANCELLED', 'RENTER'), ('SIGNED', 'CANCELLED', 'BUSINESS'),
  ('CONFIRMED', 'ACTIVE', 'BUSINESS'),
  ('CONFIRMED', 'CONTRACT_DRAFT', 'SYSTEM'),
  ('CONFIRMED', 'CANCELLED', 'RENTER'), ('CONFIRMED', 'CANCELLED', 'BUSINESS'),
  ('ACTIVE', 'RETURNED', 'BUSINESS'),
  ('RETURNED', 'COMPLETED', 'BUSINESS')
on conflict do nothing;

-- Default agreement. ⚠️ Must be reviewed by qualified Philippine legal counsel before production use.
insert into public.contract_templates (name, version, is_active, sections) values ('Standard Vehicle Rental Agreement', 1, true, $json$[
 {"key":"parties","title":"1. Parties","body":"This Vehicle Rental Agreement (the \"Agreement\") is entered into on {{agreement_date}} under booking reference {{booking_reference}} by and between:\n\nRENTAL PROVIDER: {{provider_name}} ({{provider_registration}}), with business address at {{provider_address}}, contact number {{provider_phone}}, email {{provider_email}}, represented by {{provider_representative}} (the \"Rental Provider\"); and\n\nRENTER: {{renter_name}}, residing at {{renter_address}}, contact number {{renter_phone}}, email {{renter_email}}, holder of driver's license no. {{renter_license}} (the \"Renter\").\n\nTECHNOLOGY PLATFORM: This Agreement was prepared and executed through {{platform_name}}, a technology marketplace and software-as-a-service platform. {{platform_name}} is not a party to this rental. It does not own, possess, operate, insure or control the Vehicle, does not provide the rental service, and does not receive or hold rental payments. The Rental Provider alone is responsible for the Vehicle and the rental service described in this Agreement."},
 {"key":"vehicle","title":"2. Vehicle","body":"The Rental Provider rents to the Renter the following vehicle (the \"Vehicle\"): {{vehicle_name}}, color {{vehicle_color}}, plate number {{vehicle_plate}}, {{vehicle_transmission}} transmission, {{vehicle_fuel}}, seating capacity {{vehicle_seats}}.\n\nService type: {{service_type}}. Authorized drivers: {{drivers_count}}. Only drivers registered with the Rental Provider and holding a valid license may operate the Vehicle."},
 {"key":"period","title":"3. Rental Period","body":"Pickup: {{pickup_at}} at {{pickup_location}}.\nReturn: {{return_at}} at {{return_location}}.\nDuration: {{rental_days}} rental day(s), each day being a period of twenty-four (24) hours from the pickup time.\n\n{{requirements_policy}}"},
 {"key":"fees","title":"4. Rental Fees","body":"Base rental: {{base_amount}} ({{rental_days}} day(s); standard daily rate {{daily_rate}}, with any applicable weekly or monthly rate already applied).\nDelivery fee: {{delivery_fee}}.\nDriver fee: {{driver_fee}}.\nOther fees: {{other_fees}}.\nDiscount: {{discount}}.\n\nTOTAL RENTAL FEE: {{total_amount}}. Amounts are in Philippine Pesos. Charges arising during the rental (fuel, excess mileage, late return, tolls, parking, damage) are billed separately under this Agreement."},
 {"key":"deposit","title":"5. Security Deposit","body":"The Renter shall pay a refundable security deposit of {{security_deposit}} on or before pickup. The Rental Provider may apply the deposit to unpaid fees, fuel, excess mileage, late return charges, traffic fines, cleaning, or damage for which the Renter is responsible, and shall provide an itemized accounting of any deduction. {{deposit_policy}}"},
 {"key":"payment","title":"6. Payment Method","body":"Agreed payment method: {{payment_method}}. Payment status at the time this Agreement was generated: {{payment_status}}.\n\nAll payments are made directly to the Rental Provider. {{platform_name}} does not process, collect, hold or guarantee any payment. Selecting a payment method does not by itself mean that payment has been made; payment is complete only when confirmed by the Rental Provider."},
 {"key":"fuel","title":"7. Fuel Policy","body":"{{fuel_policy}}"},
 {"key":"mileage","title":"8. Mileage Policy","body":"{{mileage_policy}}"},
 {"key":"late_return","title":"9. Late Return","body":"The Vehicle must be returned on or before the return time stated above. {{late_return_policy}} The Renter must inform the Rental Provider as early as possible of any expected delay. Extensions are valid only if confirmed by the Rental Provider and remain subject to availability."},
 {"key":"condition","title":"10. Vehicle Condition","body":"The parties shall jointly inspect the Vehicle at pickup and at return and may record its condition, fuel level, odometer reading and existing damage through a checklist, photographs or video. The Renter acknowledges receiving the Vehicle in good, clean and roadworthy condition except as recorded at pickup, and shall return it in the same condition, ordinary wear and tear excepted."},
 {"key":"damage","title":"11. Damage","body":"The Renter is responsible for loss of or damage to the Vehicle, its parts, accessories and documents occurring during the rental period, except damage caused by the Vehicle's pre-existing defects or by the Rental Provider's fault. Liability shall not exceed the actual and reasonable cost of repair or replacement, any applicable insurance participation fee or deductible, and reasonable loss of use as documented by the Rental Provider."},
 {"key":"accident","title":"12. Accident Procedure","body":"In case of an accident, theft or breakdown, the Renter shall: (a) ensure the safety of all persons and call emergency services (911) if needed; (b) notify the Rental Provider immediately at {{provider_phone}}; (c) obtain a police report and the names, contact details, license and plate numbers of other parties and witnesses; (d) take photographs of the scene; and (e) not admit liability, settle, or authorize repairs without the Rental Provider's written consent."},
 {"key":"violations","title":"13. Traffic Violations","body":"The Renter is responsible for all traffic and parking violations, toll fees, impounding and related charges (including LTO, MMDA, LGU and expressway violations) incurred during the rental period, including violations notified after the Vehicle is returned. The Rental Provider may charge such amounts against the security deposit with supporting documentation."},
 {"key":"prohibited","title":"14. Prohibited Use","body":"The Vehicle shall not be used: (a) by any unauthorized or unlicensed driver; (b) while under the influence of alcohol or prohibited drugs; (c) for any unlawful purpose, including the transport of contraband; (d) for racing, towing, off-road driving or driving instruction; (e) to carry passengers or goods for hire without the Rental Provider's consent; (f) beyond the seating capacity; (g) outside the island of Cebu, including by sea vessel, without the Rental Provider's prior written consent; or (h) for sub-leasing. Additional restrictions: {{prohibited_use_extra}}"},
 {"key":"insurance","title":"15. Insurance","body":"The Rental Provider maintains the insurance coverage required by Philippine law for the Vehicle (including Compulsory Third Party Liability) and any additional coverage it has disclosed to the Renter. Coverage is void if the Vehicle is used in breach of Section 14. The Renter shall bear any insurance participation fee or deductible for claims arising from the rental. {{platform_name}} does not provide any insurance."},
 {"key":"cancellation","title":"16. Cancellation","body":"{{cancellation_policy}} Cancellation by the Rental Provider entitles the Renter to a full refund of all amounts paid for the cancelled rental."},
 {"key":"return","title":"17. Return Requirements","body":"The Renter shall return the Vehicle at the agreed place and time with all keys, documents, accessories and equipment, in clean condition, and with the agreed fuel level. The Rental Provider shall inspect the Vehicle upon return and inform the Renter of any charges. Other terms: {{other_terms}}"},
 {"key":"disputes","title":"18. Dispute Process","body":"The parties shall first attempt in good faith to settle any dispute arising from this Agreement amicably within fifteen (15) days of written notice. If unresolved, the dispute may be brought before the proper courts of {{provider_city}}, without prejudice to remedies available under the Consumer Act of the Philippines. This Agreement is governed by the laws of the Republic of the Philippines. Upon lawful request, {{platform_name}} may make available its electronic records of this booking and its signatures."},
 {"key":"signatures","title":"19. Electronic Signatures","body":"The parties agree to execute this Agreement electronically in accordance with Republic Act No. 8792 (Electronic Commerce Act of 2000). Electronic signatures applied through {{platform_name}} have the same legal effect as handwritten signatures. For each signature, the platform records the signer's account, name, date and time, IP address, device information, the contract version, and a cryptographic fingerprint (SHA-256) of this Agreement's content. Any change to this Agreement after signing requires a new version signed by the parties. Personal data in this Agreement is processed in accordance with Republic Act No. 10173 (Data Privacy Act of 2012)."}
]$json$::jsonb)
on conflict (name, version) do nothing;

insert into public.platform_settings (key, value) values
  ('support_email', '"support@13c.ph"'::jsonb),
  ('launch_cities', '["Cebu City","Mandaue","Lapu-Lapu","Mactan","Talisay","Consolacion","Liloan"]'::jsonb),
  ('booking_min_lead_hours', '1'::jsonb)
on conflict (key) do nothing;

-- Realtime (RLS-filtered postgres_changes)
alter publication supabase_realtime add table public.messages, public.conversations, public.notifications;

-- Hourly expiry of stale requests (pg_cron is optional; skipped if unavailable)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('13c-expire-stale-bookings', '7 * * * *', 'select public.expire_stale_bookings()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
