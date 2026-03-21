export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  investment_tendency?: "male" | "female" | "business" | "other" | null;
  status: "active" | "inactive";
  tags: string[];
  memo?: string | null;
  address?: string | null;
  detail_address?: string | null;
  postal_code?: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerFormData = {
  name: string;
  phone: string;
  email?: string;
  birth_date?: string;
  investment_tendency?: "male" | "female" | "business" | "other" | "";
  status: "active" | "inactive";
  tags?: string;
  memo?: string;
  address?: string;
  detail_address?: string;
  postal_code?: string;
};

export type Group = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
};

export type CustomerGroup = {
  id: string;
  user_id: string;
  customer_id: string;
  group_id: string;
  created_at: string;
  customer?: Customer;
  group?: Group;
};

export type SubscriptionPlan = 'Free' | 'Pro' | 'Enterprise';

export type UserProfile = {
  id: string;
  email: string;
  is_admin: boolean;
  plan: SubscriptionPlan;
  status: 'pending' | 'approved' | 'rejected';
  plan_request?: SubscriptionPlan | null;
  depositor_name?: string | null;
  payment_status?: 'pending' | 'completed' | 'failed' | 'downgrade_reserved' | null;
  plan_request_at?: string | null;
  subscription_end_date?: string | null;
  created_at: string;
};

export type PaymentLog = {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  depositor_name: string;
  status: 'pending' | 'approved' | 'rejected';
  start_date?: string | null;
  end_date?: string | null;
  requested_at: string;
  processed_at?: string | null;
  user?: UserProfile;
};
