const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function headers() {
  return {
    apikey: supabaseAnonKey || '',
    ...(supabaseAnonKey?.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseAnonKey}` } : {}),
    'Content-Type': 'application/json',
  };
}

export async function insertFoundingLeaderApplication(payload: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseAnonKey) return { error: new Error('Supabase is not configured.'), id: null as string | null };
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/founding_leader_applications`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let details: { code?: string; message?: string } = {};
      try { details = await response.json(); } catch { /* empty response */ }
      return { error: Object.assign(new Error(details.message || 'Application could not be saved.'), { code: details.code }), id: null as string | null };
    }
    return { error: null, id: null as string | null };
  } catch {
    return { error: new Error('Network error. Please try again.'), id: null as string | null };
  }
}


export type FeedbackApplication = {
  full_name: string;
  email: string;
  platform: string;
  discipleship_system: string;
  disciple_count: string;
  church_ministry: string | null;
  city_country: string | null;
  leadership_role: string | null;
  threads_username: string | null;
  created_at: string;
  status: string;
  feedback_submitted_at: string | null;
};

export async function getFoundingLeaderForFeedback(input: { email: string }) {
  if (!supabaseUrl || !supabaseAnonKey) return { error: new Error('Supabase is not configured.'), application: null as FeedbackApplication | null };
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/get_founding_leader_for_feedback`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        p_email: input.email.trim().toLowerCase(),
      }),
    });
    if (!response.ok) {
      let details: { message?: string } = {};
      try { details = await response.json(); } catch { /* empty response */ }
      return { error: new Error(details.message || 'No application was found for that email address.'), application: null as FeedbackApplication | null };
    }
    const application = await response.json() as FeedbackApplication;
    return { error: null, application };
  } catch {
    return { error: new Error('Network error. Please try again.'), application: null as FeedbackApplication | null };
  }
}

export async function submitFoundingLeaderFeedback(input: { email: string; feedback: string; selfReportedDiscipleCount: number; selfReportedTestingDays: number }) {
  if (!supabaseUrl || !supabaseAnonKey) return { error: new Error('Supabase is not configured.') };
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/submit_founding_leader_feedback`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        p_email: input.email.trim().toLowerCase(),
        p_feedback: input.feedback.trim(),
        p_self_reported_disciple_count: input.selfReportedDiscipleCount,
        p_self_reported_testing_days: input.selfReportedTestingDays,
      }),
    });
    if (!response.ok) {
      let details: { message?: string } = {};
      try { details = await response.json(); } catch { /* empty response */ }
      return { error: new Error(details.message || 'Feedback could not be submitted.') };
    }
    return { error: null };
  } catch {
    return { error: new Error('Network error. Please try again.') };
  }
}
