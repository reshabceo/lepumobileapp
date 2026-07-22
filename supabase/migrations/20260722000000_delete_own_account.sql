-- Allow authenticated patients to permanently delete their own account (App Store 5.1.1(v)).
-- Deletes patient-linked rows best-effort, then removes auth.users.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_patient_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE auth_user_id = v_uid;

  IF v_patient_id IS NOT NULL THEN
    -- Best-effort cleanup of common patient-owned tables (ignore if table missing)
    BEGIN DELETE FROM public.vital_signs WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.devices WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.health_recommendations WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.patient_subscriptions WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.patient_cameras WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.appointments WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.chat_messages WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.messages WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.medical_reports WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.prescriptions WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.insurance_claims WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
    BEGIN DELETE FROM public.call_logs WHERE patient_id = v_patient_id; EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

    DELETE FROM public.patients WHERE id = v_patient_id;
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
